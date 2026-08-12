import 'dotenv/config';

import { removeFromCollection } from '../mongo.js';

async function main() {
    const guildId = process.argv[2] || process.env.GUILD_ID;
    if (!guildId) {
        throw new Error('No guildId provided (pass as first arg or set GUILD_ID)');
    }
    const query = { guildId, source: 'migration' };
    const anchors = await removeFromCollection('RolePositionAnchor', query);
    console.log(`Removed seeded role position anchors=${anchors ?? 0}`);
}

try {
    await main();
    process.exit(0);
} catch (err) {
    console.error(err);
    process.exit(1);
}
