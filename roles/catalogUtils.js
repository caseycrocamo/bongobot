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
