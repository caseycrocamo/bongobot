import 'dotenv/config';

import { slugify } from '../roles/catalogUtils.js';
import {
    ensureGameIndexes,
    ensureCategoryIndexes,
    upsertGame,
    bulkUpsertCategories,
    getAllManagedRoles,
} from '../mongo.js';

const guildId = process.env.GUILD_ID;

// One-time seed list: the original hardcoded category order that existed before
// the Category collection became authoritative. Kept inline so this migration
// stays self-contained and reproducible.
const SEED_CATEGORY_ORDER = [
    'Elementalist',
    'Mesmer',
    'Necromancer',
    'Thief',
    'Engineer',
    'Ranger',
    'Revenant',
    'Warrior',
    'Guild Activities',
    'General',
];

async function main() {
    await ensureGameIndexes();
    await ensureCategoryIndexes();

    // Upsert the single seed game "Guild Wars 2" and capture its _id.
    const now = new Date();
    const game = await upsertGame({
        guildId,
        name: 'Guild Wars 2',
        slug: slugify('Guild Wars 2'),
        source: 'migration',
        createdAt: now,
        createdBy: 'migration',
    });
    const gameId = game._id;

    // Category names = the canonical order, unioned with any category values
    // actually present on achievement roles (defensive back-fill for ad-hoc
    // categories created via the admin route). Order preserved.
    const roles = await getAllManagedRoles(guildId);
    const fromRoles = roles
        .filter((r) => r.type === 'achievement' && r.category)
        .map((r) => r.category);
    const names = [...new Set([...SEED_CATEGORY_ORDER, ...fromRoles])];

    const docs = names.map((name) => {
        const idx = SEED_CATEGORY_ORDER.indexOf(name);
        return {
            guildId,
            name,
            slug: slugify(name),
            gameId,
            order: idx === -1 ? SEED_CATEGORY_ORDER.length : idx,
            source: 'migration',
            createdAt: now,
            createdBy: 'migration',
        };
    });

    const result = await bulkUpsertCategories(docs);
    const inserted = result?.upsertedCount ?? 0;
    const updated = result?.modifiedCount ?? 0;
    const unchanged = (result?.matchedCount ?? 0) - updated;

    console.log(`Seeded game "Guild Wars 2"; categories: inserted=${inserted} updated=${updated} unchanged=${unchanged} total=${docs.length}`);
}

try {
    await main();
    process.exit(0);
} catch (err) {
    console.error(err);
    process.exit(1);
}
