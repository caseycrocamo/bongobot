import 'dotenv/config';

import { removeFromCollection } from '../mongo.js';

async function main() {
    const query = { guildId: process.env.GUILD_ID, source: 'migration' };
    const deletedCount = await removeFromCollection('ManagedRole', query);
    console.log(`Removed seeded roles: deleted=${deletedCount ?? 0}`);
}

try {
    await main();
    process.exit(0);
} catch (err) {
    console.error(err);
    process.exit(1);
}
