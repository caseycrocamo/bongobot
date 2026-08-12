import express from 'express';
import 'dotenv/config';
import fetch from 'node-fetch';
import { requireAdminSecret } from './adminAuth.js';
import { insertManagedRole, deleteManagedRole, updateManagedRoleDiscordId, insertGame, getAllGames, getGameById, insertCategory, getNextCategoryOrder } from '../mongo.js';
import { generateUniqueCustomId, invalidate as invalidateCatalog, invalidateCategories, invalidateGames, getCollectionCategoryNames } from '../roles/effectiveCatalog.js';
import { slugify } from '../roles/catalogUtils.js';
import { createAndPositionRole } from '../roles/roles.js';
import { GetGuildRoles } from '../discordclient.js';
import { invalidateRolesCache } from './dashboard.js';

const router = express.Router();

const VALID_TYPES = new Set(['achievement', 'profession', 'crafting']);
const MAX_ICON_BYTES = 256 * 1024;
const FETCH_TIMEOUT_MS = 5000;

const DATA_URI_RE = /^data:image\/(png|jpeg);base64,/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function colorToHex(color) {
    return '#' + Number(color).toString(16).padStart(6, '0');
}

// Reject hostnames that could be used to reach internal/loopback/link-local
// addresses (SSRF guard for the icon-URL fetch).
function isBlockedHostname(hostname) {
    const host = String(hostname).toLowerCase();
    if (host === 'localhost' || host === '::1') return true;
    if (host.endsWith('.local')) return true;
    if (host.startsWith('127.')) return true;
    if (host.startsWith('10.')) return true;
    if (host.startsWith('192.168.')) return true;
    if (host.startsWith('169.254.')) return true;
    return false;
}

// Resolve the requested icon into a data: URI, or null when there is no icon.
// Throws { status, message } on any validation/fetch failure so the handler can
// translate it into a 400 response.
async function resolveIconDataUri({ iconSource, iconData, iconUrl }) {
    if (!iconSource || iconSource === 'none') {
        return null;
    }

    if (iconSource === 'upload') {
        if (typeof iconData !== 'string' || !DATA_URI_RE.test(iconData)) {
            throw { status: 400, message: 'iconData must be a data:image/png or data:image/jpeg base64 URI' };
        }
        const b64 = iconData.slice(iconData.indexOf(',') + 1);
        const buf = Buffer.from(b64, 'base64');
        if (buf.byteLength > MAX_ICON_BYTES) {
            throw { status: 400, message: 'Icon exceeds the 256KB size limit' };
        }
        return iconData;
    }

    if (iconSource === 'url') {
        let parsed;
        try {
            parsed = new URL(iconUrl);
        } catch {
            throw { status: 400, message: 'iconUrl is not a valid URL' };
        }
        if (parsed.protocol !== 'https:') {
            throw { status: 400, message: 'iconUrl must use https' };
        }
        if (isBlockedHostname(parsed.hostname)) {
            throw { status: 400, message: 'iconUrl host is not allowed' };
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        let res;
        try {
            res = await fetch(parsed.toString(), { signal: controller.signal });
        } catch {
            throw { status: 400, message: 'Failed to fetch iconUrl' };
        } finally {
            clearTimeout(timer);
        }

        if (!res.ok) {
            throw { status: 400, message: 'Failed to fetch iconUrl' };
        }

        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        let mime;
        if (contentType.startsWith('image/png')) {
            mime = 'image/png';
        } else if (contentType.startsWith('image/jpeg')) {
            mime = 'image/jpeg';
        } else {
            throw { status: 400, message: 'iconUrl must point to a PNG or JPEG image' };
        }

        let buf;
        try {
            buf = await res.arrayBuffer();
        } catch {
            throw { status: 400, message: 'Failed to read iconUrl response' };
        }
        if (buf.byteLength > MAX_ICON_BYTES) {
            throw { status: 400, message: 'Icon exceeds the 256KB size limit' };
        }
        return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
    }

    throw { status: 400, message: 'Unknown iconSource' };
}

async function handler(req, res) {
    const guildId = process.env.GUILD_ID;
    let insertedId = null;

    try {
        const body = req.body || {};
        const { type, mentionable } = body;

        // --- type ---
        if (!VALID_TYPES.has(type)) {
            return res.status(400).json({ error: 'Invalid type' });
        }

        // --- short_name ---
        if (typeof body.short_name !== 'string') {
            return res.status(400).json({ error: 'short_name is required' });
        }
        const short_name = body.short_name.trim();
        if (short_name.length < 1 || short_name.length > 80) {
            return res.status(400).json({ error: 'short_name must be 1-80 characters' });
        }

        // --- description ---
        let description;
        if (type === 'profession') {
            description = '';
        } else {
            if (typeof body.description !== 'string' || body.description.trim().length < 1) {
                return res.status(400).json({ error: 'description is required' });
            }
            description = body.description;
        }

        // --- name ---
        let name;
        if (type === 'profession') {
            name = short_name;
        } else {
            name = `${short_name} - ${description}`;
        }
        if (name.length > 100) {
            return res.status(400).json({ error: 'Resulting role name exceeds 100 characters' });
        }

        // --- category ---
        let category;
        if (type === 'achievement') {
            // Valid categories come from the authoritative Category collection
            // (admin-managed, each assigned to a game).
            const validCategories = await getCollectionCategoryNames();
            if (!validCategories.includes(body.category)) {
                return res.status(400).json({ error: 'Invalid category for achievement' });
            }
            category = body.category;
        } else {
            category = null;
        }

        // --- color ---
        let color = 0;
        if (body.color !== undefined && body.color !== null && body.color !== '') {
            if (typeof body.color !== 'string' || !COLOR_RE.test(body.color)) {
                return res.status(400).json({ error: 'color must be a #RRGGBB hex string' });
            }
            color = parseInt(body.color.slice(1), 16);
        }

        // --- mentionable ---
        const isMentionable = typeof mentionable === 'boolean' ? mentionable : true;

        // --- icon ---
        let iconDataUri;
        try {
            iconDataUri = await resolveIconDataUri(body);
        } catch (iconErr) {
            const status = iconErr && iconErr.status ? iconErr.status : 400;
            const message = iconErr && iconErr.message ? iconErr.message : 'Invalid icon';
            return res.status(status).json({ error: message });
        }

        // --- duplicate pre-check against live guild roles ---
        const live = await GetGuildRoles(guildId);
        if (Array.isArray(live) && live.some((role) => role && role.name === name)) {
            return res.status(409).json({ error: 'A role with that name already exists' });
        }

        // --- unique custom id ---
        const custom_id = await generateUniqueCustomId(short_name);

        // --- insert DB row first ---
        const doc = {
            type,
            short_name,
            description,
            category,
            custom_id,
            color,
            mentionable: isMentionable,
            icon: iconDataUri,
            name,
            discordRoleId: null,
            guildId,
            source: 'admin',
            createdAt: new Date(),
            createdBy: 'admin',
        };

        try {
            insertedId = await insertManagedRole(doc);
        } catch (err) {
            if (err && err.code === 11000) {
                return res.status(409).json({ error: 'A role with that custom_id already exists' });
            }
            throw err;
        }
        // insertManagedRole swallows internal errors and returns undefined; guard so we
        // never create an orphaned Discord role with no backing catalog document.
        if (!insertedId) {
            return res.status(500).json({ error: 'Failed to persist role definition' });
        }

        // --- create the Discord role ---
        const rolePayload = { name, color, mentionable: isMentionable };
        if (iconDataUri) {
            rolePayload.icon = iconDataUri;
        }

        let warning;
        let created = await createAndPositionRole(rolePayload);

        // Retry without an icon if the guild lacks the role-icon feature.
        if ((!created || !created.id) && iconDataUri) {
            created = await createAndPositionRole({ name, color, mentionable: isMentionable });
            if (created && created.id) {
                warning = 'Role created without icon (guild may lack role-icon support).';
            }
        }

        if (!created || !created.id) {
            // Roll back the DB row so we don't leave an orphaned definition.
            try {
                await deleteManagedRole(insertedId);
            } catch (rollbackErr) {
                console.error('Rollback delete failed for managed role', { custom_id, _id: insertedId }, rollbackErr);
            }
            insertedId = null;
            return res.status(502).json({ error: 'Failed to create the Discord role', custom_id });
        }

        // --- persist the discord role id + bust caches ---
        await updateManagedRoleDiscordId(guildId, custom_id, created.id);
        invalidateCatalog();
        invalidateRolesCache();

        return res.status(201).json({
            role: {
                type,
                short_name: doc.short_name,
                description,
                category,
                custom_id,
                name,
                color,
                colorHex: colorToHex(color),
                mentionable: isMentionable,
                icon: iconDataUri,
                discordRoleId: created.id,
            },
            ...(warning ? { warning } : {}),
        });
    } catch (err) {
        console.error('Unexpected error creating admin role', err);
        if (insertedId) {
            try {
                await deleteManagedRole(insertedId);
            } catch (rollbackErr) {
                console.error('Rollback delete failed after unexpected error', rollbackErr);
            }
        }
        return res.status(500).json({ error: 'Internal error' });
    }
}

// Lightweight secret check for the admin login screen. Side-effect free: returns
// 200 only when requireAdminSecret accepts the x-admin-secret header, else 401.
router.get('/api/admin/session', requireAdminSecret, (_req, res) => {
    res.json({ ok: true });
});

router.post('/api/admin/roles', requireAdminSecret, express.json({ limit: '1mb' }), handler);

// --- Games (admin-only grouping of categories) ---

router.get('/api/admin/games', requireAdminSecret, async (_req, res) => {
    const guildId = process.env.GUILD_ID;
    const games = await getAllGames(guildId);
    return res.json({ games: games.map((g) => ({ id: String(g._id), name: g.name, slug: g.slug })) });
});

router.post('/api/admin/games', requireAdminSecret, express.json(), async (req, res) => {
    const guildId = process.env.GUILD_ID;
    const body = req.body || {};

    if (typeof body.name !== 'string') {
        return res.status(400).json({ error: 'name is required' });
    }
    const name = body.name.trim();
    if (name.length < 1 || name.length > 80) {
        return res.status(400).json({ error: 'name must be 1-80 characters' });
    }
    const slug = slugify(name);
    if (!slug) {
        return res.status(400).json({ error: 'name must contain at least one alphanumeric character' });
    }

    const doc = { guildId, name, slug, source: 'admin', createdAt: new Date(), createdBy: 'admin' };
    try {
        const insertedId = await insertGame(doc);
        // Bust the games cache so the new game appears in the overview / grouping
        // without a restart.
        invalidateGames();
        return res.status(201).json({ game: { id: String(insertedId), name, slug } });
    } catch (err) {
        if (err && err.code === 11000) {
            return res.status(409).json({ error: 'A game with that name already exists' });
        }
        console.error('Unexpected error creating game', err);
        return res.status(500).json({ error: 'Internal error' });
    }
});

// --- Categories (assigned to a game; authoritative category list) ---

router.post('/api/admin/categories', requireAdminSecret, express.json(), async (req, res) => {
    const guildId = process.env.GUILD_ID;
    const body = req.body || {};

    if (typeof body.name !== 'string') {
        return res.status(400).json({ error: 'name is required' });
    }
    const name = body.name.trim();
    if (name.length < 1 || name.length > 80) {
        return res.status(400).json({ error: 'name must be 1-80 characters' });
    }

    if (typeof body.gameId !== 'string' || !body.gameId.trim()) {
        return res.status(400).json({ error: 'gameId is required' });
    }
    const game = await getGameById(guildId, body.gameId.trim());
    if (!game) {
        return res.status(400).json({ error: 'gameId does not match an existing game' });
    }

    const slug = slugify(name);
    if (!slug) {
        return res.status(400).json({ error: 'name must contain at least one alphanumeric character' });
    }

    const order = await getNextCategoryOrder(guildId);
    const doc = { guildId, name, slug, gameId: game._id, order, source: 'admin', createdAt: new Date(), createdBy: 'admin' };
    try {
        const insertedId = await insertCategory(doc);
        // Refresh the category-name cache so the new (empty) category is
        // immediately selectable in the add-role drawer / dashboard filter.
        invalidateCategories();
        return res.status(201).json({ category: { id: String(insertedId), name, slug, gameId: String(game._id) } });
    } catch (err) {
        if (err && err.code === 11000) {
            return res.status(409).json({ error: 'A category with that name already exists' });
        }
        console.error('Unexpected error creating category', err);
        return res.status(500).json({ error: 'Internal error' });
    }
});

export default router;
