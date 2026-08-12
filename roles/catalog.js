import { getAchievementDefs, getAllDefs, getAchievementCategories, getCollectionCategoryNames } from './effectiveCatalog.js';
import { countAchievementCategories, paginateAchievementDefs } from './catalogUtils.js';

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

export async function getAchievementsPage(page, pageSize, options = {}) {
    const all = await getAchievementDefs();
    // Filter (by options.categoryNames) + clamp + slice happens in the pure
    // helper so pagination reflects the filtered result and stays unit-testable.
    const { items, pagination } = paginateAchievementDefs(all, page, pageSize, options);
    return { items: items.map(normalizeAchievement), pagination };
}

// Unfiltered grand total of achievement defs, for the summary stat tile which
// must stay constant while the table is filtered.
export async function getAchievementsTotal() {
    return (await getAchievementDefs()).length;
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

// Per-category achievement counts across ALL achievement defs (not just the
// current page), so the dashboard's per-game/per-category totals stay accurate
// beyond one page of results. Returns a plain object categoryName -> count.
export async function getAchievementCategoryCounts() {
    const all = await getAchievementDefs();
    return countAchievementCategories(all);
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
