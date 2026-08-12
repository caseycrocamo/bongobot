// Pure helpers for the DB-backed role catalog. No imports (no DB / env) so they
// are safe to unit test in isolation and reuse across the effective catalog,
// the dashboard route, and the admin create-role route.

/** Integer Discord color -> '#rrggbb'. */
export function toColorHex(color) {
    return '#' + Number(color).toString(16).padStart(6, '0');
}

/** '#rrggbb' (or 'rrggbb') -> integer. Returns NaN for malformed input. */
export function hexToInt(hex) {
    return parseInt(String(hex).replace(/^#/, ''), 16);
}

/** Slug used as a role's custom_id: lowercase, alphanumeric only. */
export function slugify(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Compute the Discord role name from its parts.
 * Profession roles use the bare short_name; achievement/crafting roles use
 * "<short_name> - <description>".
 */
export function computeRoleName(type, short_name, description) {
    return type === 'profession' ? short_name : `${short_name} - ${description}`;
}

/**
 * Produce a custom_id slug for short_name that does not collide with any id in
 * existingIds (an array or Set). Appends 2,3,4... until unique.
 */
export function generateUniqueCustomIdFrom(short_name, existingIds) {
    const set = existingIds instanceof Set ? existingIds : new Set(existingIds || []);
    const base = slugify(short_name);
    if (!set.has(base)) {
        return base;
    }
    let n = 2;
    while (set.has(base + n)) {
        n++;
    }
    return base + n;
}

/**
 * Count achievement defs by their `category` name.
 * Returns a plain object of categoryName -> count across ALL supplied defs
 * (caller is responsible for passing the full, unpaged def list). Defs with a
 * null/empty category are ignored.
 */
export function countAchievementCategories(defs) {
    const counts = {};
    for (const def of defs || []) {
        const name = def && def.category;
        if (!name) continue;
        counts[name] = (counts[name] || 0) + 1;
    }
    return counts;
}

/**
 * Filter (by allowed category names) then paginate a list of achievement defs.
 * Pure so the filter/clamp/slice logic behind getAchievementsPage() is
 * unit-testable without a DB.
 *
 * @param {Array<{category:string}>} defs full (unpaged) achievement defs
 * @param {number} page 1-based page (clamped to [1, totalPages])
 * @param {number} pageSize
 * @param {{categoryNames?:Set<string>|string[]|null}} options
 *        when categoryNames is provided, defs are filtered to those categories
 *        BEFORE total/totalPages/slice are computed
 * @returns {{items:Array, pagination:{page:number,pageSize:number,total:number,totalPages:number}}}
 */
export function paginateAchievementDefs(defs, page, pageSize, options = {}) {
    const { categoryNames = null } = options;
    let all = defs || [];
    if (categoryNames != null) {
        const allowed = categoryNames instanceof Set ? categoryNames : new Set(categoryNames);
        all = all.filter((def) => allowed.has(def && def.category));
    }
    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const clampedPage = Math.min(Math.max(page, 1), totalPages);
    const start = (clampedPage - 1) * pageSize;
    const items = all.slice(start, start + pageSize);
    return { items, pagination: { page: clampedPage, pageSize, total, totalPages } };
}

// Sentinel gameId for the synthetic "Ungrouped" card (whose real game id is
// null). Shared between the client and the dashboard route so an "Ungrouped"
// whole-game selection is distinguishable from "show all".
export const UNGROUPED_FILTER_ID = '__ungrouped__';

/**
 * Resolve an active table filter to the set of allowed category names.
 *
 * @param {Array<{id:string|null,categories:Array<{name:string}>}>} games
 *        Output of buildGamesWithCategories (unfiltered, full catalog).
 * @param {{gameId?:string,category?:string}} filter
 * @returns {string[]|null} allowed category names, or null for "no filter".
 *
 * - A non-empty `category` → `[category]` (direct filter).
 * - Else a `gameId` (a real id, or UNGROUPED_FILTER_ID → the entry with
 *   id === null) → that game's `categories.map(c => c.name)`. Unknown gameId →
 *   `[]` (empty result, not "all").
 * - Else → null (no filter).
 */
export function resolveFilterCategoryNames(games, filter) {
    const { gameId, gameIds, category } = filter || {};
    if (typeof category === 'string' && category.length > 0) {
        return [category];
    }
    // Multi-select: union of the selected games' category names (de-duplicated,
    // first-seen order). An explicit empty array means "nothing selected" → no
    // results; unrecognized ids contribute nothing.
    if (Array.isArray(gameIds)) {
        const names = [];
        const seen = new Set();
        for (const id of gameIds) {
            const targetId = id === UNGROUPED_FILTER_ID ? null : id;
            const game = (games || []).find((g) => g.id === targetId);
            if (!game) continue;
            for (const c of game.categories || []) {
                if (!seen.has(c.name)) {
                    seen.add(c.name);
                    names.push(c.name);
                }
            }
        }
        return names;
    }
    if (typeof gameId === 'string' && gameId.length > 0) {
        const targetId = gameId === UNGROUPED_FILTER_ID ? null : gameId;
        const game = (games || []).find((g) => g.id === targetId);
        if (!game) {
            return [];
        }
        return (game.categories || []).map((c) => c.name);
    }
    return null;
}

// Read a count for a category name from either a plain object or a Map.
function lookupCount(counts, name) {
    if (!counts) return 0;
    if (counts instanceof Map) return counts.get(name) || 0;
    return counts[name] || 0;
}

/**
 * Group categories under their owning game and fold in per-category counts.
 *
 * @param {Array<{_id:any,name:string,slug:string}>} games
 * @param {Array<{name:string,slug:string,gameId:any,order?:number}>} categories
 *        (expected pre-sorted by `order`)
 * @param {Object|Map} counts categoryName -> achievement count
 * @returns {Array<{id:string|null,name:string,slug:string,count:number,
 *                  categories:Array<{name:string,slug:string,count:number}>}>}
 *
 * Categories whose `gameId` matches no game are collected into a synthetic
 * "Ungrouped" bucket (id null), which is appended only when non-empty. ObjectId
 * vs string ids are compared via String() on both sides.
 */
export function buildGamesWithCategories(games, categories, counts) {
    const cats = categories || [];
    const gameList = (games || []).map((game) => {
        const gameKey = String(game._id);
        const grouped = cats
            .filter((cat) => String(cat.gameId) === gameKey)
            .map((cat) => ({ name: cat.name, slug: cat.slug, count: lookupCount(counts, cat.name) }));
        const count = grouped.reduce((sum, c) => sum + c.count, 0);
        return { id: String(game._id), name: game.name, slug: game.slug, count, categories: grouped };
    });

    const knownGameKeys = new Set((games || []).map((game) => String(game._id)));
    const ungrouped = cats
        .filter((cat) => !knownGameKeys.has(String(cat.gameId)))
        .map((cat) => ({ name: cat.name, slug: cat.slug, count: lookupCount(counts, cat.name) }));
    if (ungrouped.length > 0) {
        gameList.push({
            id: null,
            name: 'Ungrouped',
            slug: 'ungrouped',
            count: ungrouped.reduce((sum, c) => sum + c.count, 0),
            categories: ungrouped,
        });
    }

    return gameList;
}
