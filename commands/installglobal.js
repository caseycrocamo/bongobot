import 'dotenv/config';
import { InstallGlobalCommands } from '../discordclient.js';
import { ALL_COMMANDS } from './commands.js';
InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);