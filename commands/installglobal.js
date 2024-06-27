import 'dotenv/config';
import { InstallGlobalCommands } from './discordclient.js';
InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);