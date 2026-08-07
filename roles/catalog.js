import { getAchievementDefs, getAllDefs, getAchievementCategories, getCollectionCategoryNames } from './effectiveCatalog.js';

function normalizeAchievement(def) {
    return {
        short_name: def.short_name,
        name: def.name,
        description: def.description,
        custom_id: def.custom_id,
        category: def.category,
        color: def.colorHex,      // dashboard expects '#rrggbb'
        mentionable: def.mentionable,
        icon: def.icon,
    };
}

export async function getAchievementsPage(page, pageSize) {
    const all = await getAchievementDefs();
    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const clampedPage = Math.min(Math.max(page, 1), totalPages);
    const start = (clampedPage - 1) * pageSize;
    const items = all.slice(start, start + pageSize).map(normalizeAchievement);
    return { items, pagination: { page: clampedPage, pageSize, total, totalPages } };
}

export async function getAchievementCategoryOrder() {
    // Prefer the authoritative Category collection so newly added (empty)
    // categories are immediately selectable in the admin UI. Fall back to the
    // materialized-from-roles list before the games migration has run.
    const fromCollection = await getCollectionCategoryNames();
    if (fromCollection.length > 0) {
        return fromCollection;
    }
    return await getAchievementCategories();
}

export async function rolesForFallback() {
    const all = await getAllDefs();
    return all.map((def) => ({
        short_name: def.short_name ?? def.name,
        name: def.name,
        color: def.colorHex,
        mentionable: def.mentionable,
    }));
}
