import 'dotenv/config';

import { ACHIEVEMENT_ROLES } from './seed-data/achievementRoles.js';
import { PROFESSION_ROLES } from './seed-data/professionRoles.js';
import { CRAFTING_ROLES } from './seed-data/craftingRoles.js';
import { bulkUpsertManagedRoles, ensureManagedRoleIndexes } from '../mongo.js';

const guildId = process.env.GUILD_ID;

function buildDocs() {
    const now = new Date();
    const docs = [];

    for (const role of ACHIEVEMENT_ROLES) {
        docs.push({
            type: 'achievement',
            short_name: role.short_name,
            description: role.description,
            category: role.category ?? null,
            custom_id: role.custom_id,
            color: role.color,
            mentionable: role.mentionable ?? true,
            icon: role.icon ?? null,
            name: role.name,
            requirements: role.requirements ?? [],
            discordRoleId: null,
            guildId,
            source: 'migration',
            createdAt: now,
            createdBy: 'migration'
        });
    }

    for (const role of CRAFTING_ROLES) {
        docs.push({
            type: 'crafting',
            short_name: role.short_name,
            description: role.description,
            category: null,
            custom_id: role.custom_id,
            color: role.color,
            mentionable: role.mentionable ?? true,
            icon: role.icon ?? null,
            name: role.name,
            discordRoleId: null,
            guildId,
            source: 'migration',
            createdAt: now,
            createdBy: 'migration'
        });
    }

    for (const role of PROFESSION_ROLES) {
        docs.push({
            type: 'profession',
            short_name: role.short_name ?? role.name,
            description: '',
            category: null,
            custom_id: role.custom_id,
            color: role.color,
            mentionable: role.mentionable ?? true,
            icon: role.icon ?? null,
            name: role.name,
            discordRoleId: null,
            guildId,
            source: 'migration',
            createdAt: now,
            createdBy: 'migration'
        });
    }

    return docs;
}

async function main() {
    const docs = buildDocs();

    await ensureManagedRoleIndexes();

    const result = await bulkUpsertManagedRoles(docs);
    const inserted = result?.upsertedCount ?? 0;
    const updated = result?.modifiedCount ?? 0;
    const unchanged = (result?.matchedCount ?? 0) - updated;

    console.log(`Seeded roles: inserted=${inserted} updated=${updated} unchanged=${unchanged} total=${docs.length}`);
}

try {
    await main();
    process.exit(0);
} catch (err) {
    console.error(err);
    process.exit(1);
}
