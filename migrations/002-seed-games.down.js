import 'dotenv/config';

import { removeFromCollection } from '../mongo.js';

async function main() {
    const query = { guildId: process.env.GUILD_ID, source: 'migration' };
    const categories = await removeFromCollection('Category', query);
    const games = await removeFromCollection('Game', query);
    console.log(`Removed seeded categories=${categories ?? 0} games=${games ?? 0}`);
}

try {
    await main();
    process.exit(0);
} catch (err) {
    console.error(err);
    process.exit(1);
}
