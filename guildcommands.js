import { InstallGuildCommands } from "./utils.js";
import { ALL_COMMANDS } from "./commands.js";

InstallGuildCommands(process.env.APP_ID, ALL_COMMANDS);