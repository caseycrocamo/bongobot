import 'dotenv/config';
import { AddGuildRoles } from './roles.js';
import { getAllManagedRoles, updateManagedRoleDiscordId } from '../mongo.js';
import { GetGuildRoles } from '../discordclient.js';

const guildId = process.env.GUILD_ID;

const managed = await getAllManagedRoles(guildId);
if(!managed || managed.length === 0){
    console.warn('No ManagedRole documents found. Run `npm run migrate:roles:up` first to seed the catalog.');
    process.exit(0);
}

// AddGuildRoles filters out roles whose name already exists in the guild, creates the rest, and repositions them.
const rolePayloads = managed.map((r) => ({
    name: r.name,
    color: r.color,
    mentionable: r.mentionable ?? true,
    ...(r.icon ? { icon: r.icon } : {}),
}));
await AddGuildRoles(rolePayloads);

// Best-effort: after creation/reorder settles, match live roles by name and persist their discordRoleId.
setTimeout(async () => {
    try {
        const live = await GetGuildRoles(guildId);
        if(Array.isArray(live)){
            for(const r of managed){
                const match = live.find((lr) => lr.name === r.name);
                if(match && match.id && match.id !== r.discordRoleId){
                    await updateManagedRoleDiscordId(guildId, r.custom_id, match.id);
                }
            }
            console.log('register-roles: discordRoleId writeback complete.');
        } else {
            console.warn('register-roles: could not fetch live guild roles for writeback.');
        }
    } catch(err){
        console.error('register-roles writeback failed:', err);
    } finally {
        process.exit(0);
    }
}, 6000);
