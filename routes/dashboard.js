import express from 'express';
import { GetGuildRoles } from '../discordclient.js';
import { getAchievementsPage, getAchievementsTotal, getAchievementCategoryOrder, getAchievementCategoryCounts, rolesForFallback } from '../roles/catalog.js';
import { getGamesWithCategories } from '../roles/effectiveCatalog.js';
import { resolveFilterCategoryNames } from '../roles/catalogUtils.js';
import { getRoleIdByName } from '../roles/roleutils.js';

const router = express.Router();

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;
const ROLES_CACHE_TTL_MS = 60 * 1000;

let rolesCache = { data: null, expiresAt: 0 };

export function invalidateRolesCache(){ rolesCache = { data: null, expiresAt: 0 }; }

function toHexColor(color) {
    return '#' + Number(color).toString(16).padStart(6, '0');
}

async function getGuildRoles() {
    const now = Date.now();
    if (rolesCache.data && rolesCache.expiresAt > now) {
        return rolesCache.data;
    }
    try {
        const roles = await GetGuildRoles(process.env.GUILD_ID);
        if (!Array.isArray(roles)) {
            throw new Error('GetGuildRoles did not return an array');
        }
        const normalized = roles
            .filter((role) => role.name !== '@everyone')
            .map((role) => ({
                id: role.id,
                name: role.name,
                color: toHexColor(role.color),
                position: role.position,
                managed: role.managed,
                mentionable: role.mentionable,
            }));
        rolesCache = { data: normalized, expiresAt: now + ROLES_CACHE_TTL_MS };
        return normalized;
    } catch (err) {
        console.error('Failed to fetch live guild roles, falling back to static catalog', err);
        return await rolesForFallback();
    }
}

function parsePageParam(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
        return fallback;
    }
    return parsed;
}

router.get('/api/achievements-and-roles', async (req, res) => {
    const page = parsePageParam(req.query.page, 1);
    const pageSize = Math.min(parsePageParam(req.query.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const gameId = typeof req.query.gameId === 'string' ? req.query.gameId : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;

    const roles = await getGuildRoles();

    // Games with nested categories + server-computed per-category counts, so the
    // dashboard can group/filter the achievements table by game and category.
    // Computed first (and always unfiltered) so card badge counts reflect the
    // full catalog and so we can resolve the active filter to category names.
    const categoryCounts = await getAchievementCategoryCounts();
    const games = await getGamesWithCategories(categoryCounts);
    const categoryNames = resolveFilterCategoryNames(games, { gameId, category });

    const achievements = await getAchievementsPage(page, pageSize, { categoryNames });
    achievements.categories = await getAchievementCategoryOrder();
    achievements.games = games;
    // Unfiltered grand total for the summary stat tile (stays constant while
    // the table is filtered); pagination.total is the FILTERED total.
    achievements.totalAchievements = await getAchievementsTotal();
    achievements.items = achievements.items.map((item) => {
        const roleId = getRoleIdByName(roles, item.name);
        const discordRole = roleId ? roles.find((role) => role.id === roleId) : undefined;
        return {
            ...item,
            discordRole: discordRole ? { id: discordRole.id, name: discordRole.name, color: discordRole.color } : null,
        };
    });

    return res.json({ achievements, roles });
});

export default router;
