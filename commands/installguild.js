import 'dotenv/config';
import { InstallGuildCommands } from './discordclient.js';
InstallGuildCommands(process.env.APP_ID, process.env.GUILD_ID, ALL_COMMANDS);