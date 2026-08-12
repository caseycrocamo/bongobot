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
