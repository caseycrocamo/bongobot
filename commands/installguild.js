import 'dotenv/config';
import { InstallGuildCommands } from '../discordclient.js';
import { ALL_COMMANDS, HELP_COMMAND } from './commands.js';
InstallGuildCommands(process.env.APP_ID, process.env.GUILD_ID, [HELP_COMMAND]);