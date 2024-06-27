import 'dotenv/config';
import { DeleteGuildCommand, GetAllGuildCommands } from '../discordclient.js';
async function DeleteAllGuildCommands(){
    const allGuildCommands = await GetAllGuildCommands(process.env.APP_ID, process.env.GUILD_ID)
    const deleteRequests = allGuildCommands.map(async (command) => {
        console.log('deleting command', command.id, 'from guild', process.env.GUILD_ID);
        await DeleteGuildCommand(process.env.APP_ID, process.env.GUILD_ID, command.id);
    });
    await Promise.all(deleteRequests);
}
DeleteAllGuildCommands();