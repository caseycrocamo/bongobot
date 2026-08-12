import 'dotenv/config';

import {
    ensureRolePositionAnchorIndexes,
    upsertRolePositionAnchor,
} from '../mongo.js';

// Guild to seed: first CLI arg (`npm run migrate:anchors:up -- <guildId>`),
// falling back to GUILD_ID from the environment.
const guildId = process.argv[2] || process.env.GUILD_ID;

// One-time seed: the Admin role is the first placement anchor. New roles created
// by the bot are positioned just below the lowest-positioned anchor.
const SEED_ANCHORS = [
    { roleId: '1536874743880228865', name: 'Admin' },
];

async function main() {
    if (!guildId) {
        throw new Error('No guildId provided (pass as first arg or set GUILD_ID)');
    }
    await ensureRolePositionAnchorIndexes();

    const now = new Date();
    for (const anchor of SEED_ANCHORS) {
        await upsertRolePositionAnchor({
            guildId,
            roleId: anchor.roleId,
            name: anchor.name,
            source: 'migration',
            createdAt: now,
            createdBy: 'migration',
        });
    }

    console.log(`Seeded role position anchors: total=${SEED_ANCHORS.length}`);
}

try {
    await main();
    process.exit(0);
} catch (err) {
    console.error(err);
    process.exit(1);
}
