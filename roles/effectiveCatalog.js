import 'dotenv/config';
import { getAllManagedRoles, getAllCategories, getAllGames } from '../mongo.js';
import { toColorHex, generateUniqueCustomIdFrom, buildGamesWithCategories } from './catalogUtils.js';

const TTL_MS = 60_000;

// Module-level cache: last-known-good defs plus expiry timestamp.
const cache = { defs: null, expiresAt: 0 };

// Separate cache for the Category collection (authoritative category rows,
// ordered by `order`). Holds full rows so both the name list and the
// game->category grouping can be derived from one fetch.
const categoryCache = { rows: null, expiresAt: 0 };

// Parallel cache for the Game collection (mirrors categoryCache).
const gamesCache = { rows: null, expiresAt: 0 };

function normalize(doc) {
    return {
        type: doc.type,
        short_name: doc.short_name,
        description: doc.description,
        category: doc.category,
        custom_id: doc.custom_id,
        name: doc.name,
        color: doc.color,
        colorHex: toColorHex(doc.color),
        mentionable: doc.mentionable,
        icon: doc.icon,
        requirements: doc.requirements ?? [],
        discordRoleId: doc.discordRoleId,
    };
}

// Single internal loader with TTL cache + last-known-good resilience.
async function loadDefs() {
    const now = Date.now();
    if (cache.defs && now < cache.expiresAt) {
        return cache.defs;
    }

    let raw;
    try {
        raw = await getAllManagedRoles(process.env.GUILD_ID);
    } catch {
        // Fetch failed: keep previous good data if we have it.
        return cache.defs ?? [];
    }

    if (!Array.isArray(raw)) {
        // Bad shape: keep previous good data if we have it.
        return cache.defs ?? [];
    }

    if (raw.length === 0 && cache.defs && cache.defs.length > 0) {
        // Don't overwrite good data with an empty result.
        return cache.defs;
    }

    const defs = raw.map(normalize);
    cache.defs = defs;
    cache.expiresAt = now + TTL_MS;
    return defs;
}

// Return copies so callers can't mutate cached objects.
function copy(defs) {
    return defs.map(d => ({ ...d }));
}

export async function getAllDefs() {
    const defs = await loadDefs();
    return copy(defs);
}

export async function getAchievementDefs() {
    const defs = await loadDefs();
    return defs.filter(d => d.type === 'achievement').map(d => ({ ...d }));
}

export async function getProfessionDefs() {
    const defs = await loadDefs();
    return defs.filter(d => d.type === 'profession').map(d => ({ ...d }));
}

export async function getCraftingDefs() {
    const defs = await loadDefs();
    return defs.filter(d => d.type === 'crafting').map(d => ({ ...d }));
}

export async function getAchievementCategories() {
    const defs = await loadDefs();
    const present = new Set(
        defs.filter(d => d.type === 'achievement').map(d => d.category)
    );
    // Order by the authoritative Category collection, keeping only categories
    // that actually have at least one achievement role (the bot grant flow).
    const order = await loadCategoryNames();
    return order.filter(c => present.has(c));
}

export async function getRoleNameByCustomId(customId) {
    const defs = await loadDefs();
    return defs.find(d => d.custom_id === customId)?.name;
}

export async function getCustomIdByRoleName(roleName) {
    const defs = await loadDefs();
    return defs.find(d => d.name === roleName)?.custom_id;
}

export async function isCustomIdAchievementRole(customId) {
    const defs = await loadDefs();
    return defs.some(d => d.custom_id === customId && d.type === 'achievement');
}

export async function generateUniqueCustomId(short_name) {
    const defs = await loadDefs();
    const existing = new Set(defs.map(d => d.custom_id));
    return generateUniqueCustomIdFrom(short_name, existing);
}

export function invalidate() {
    cache.defs = null;
    cache.expiresAt = 0;
}

// Category-collection loader (TTL cache + last-known-good), independent of the
// role-defs cache. Returns full category rows ordered by their `order` field.
async function loadCategories() {
    const now = Date.now();
    if (categoryCache.rows && now < categoryCache.expiresAt) {
        return categoryCache.rows;
    }

    let rows;
    try {
        rows = await getAllCategories(process.env.GUILD_ID);
    } catch {
        return categoryCache.rows ?? [];
    }

    if (!Array.isArray(rows)) {
        return categoryCache.rows ?? [];
    }

    categoryCache.rows = rows;
    categoryCache.expiresAt = now + TTL_MS;
    return rows;
}

// Authoritative category names from the Category collection (empty array before
// the games migration has run). Consumers should fall back as appropriate.
export async function getCollectionCategoryNames() {
    return (await loadCategories()).map((r) => r.name);
}

export function invalidateCategories() {
    categoryCache.rows = null;
    categoryCache.expiresAt = 0;
}

// Game-collection loader (TTL cache + last-known-good), mirroring loadCategories.
// Returns full game rows ({ _id, name, slug }).
async function loadGames() {
    const now = Date.now();
    if (gamesCache.rows && now < gamesCache.expiresAt) {
        return gamesCache.rows;
    }

    let rows;
    try {
        rows = await getAllGames(process.env.GUILD_ID);
    } catch {
        return gamesCache.rows ?? [];
    }

    if (!Array.isArray(rows)) {
        return gamesCache.rows ?? [];
    }

    gamesCache.rows = rows;
    gamesCache.expiresAt = now + TTL_MS;
    return rows;
}

export function invalidateGames() {
    gamesCache.rows = null;
    gamesCache.expiresAt = 0;
}

/**
 * Games with their nested categories and per-category achievement counts.
 * `counts` is an optional categoryName -> count map (from
 * getAchievementCategoryCounts) folded into each nested category (and summed per
 * game); omitted counts default to 0. Categories whose gameId matches no game
 * fall into a synthetic "Ungrouped" bucket (id null), included only when
 * non-empty. See buildGamesWithCategories for the shape.
 */
export async function getGamesWithCategories(counts = {}) {
    const [games, categories] = await Promise.all([loadGames(), loadCategories()]);
    return buildGamesWithCategories(games, categories, counts);
}
