import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';

const TIMESTAMP_COMMAND = {
    name: 'timestamp',
    description: 'create a relative unix timestamp',
    type: 1,
    options: [
      {
        type: 3,
        name: 'relative_time',
        description:"use the format: in 9 hours 30 minutes. You must include both hours and minutes and start with the word in. You can shorten hours to h and minutes to m. Ex. in 9h 10m",
        required: true
      }
    ]
};

export const ALL_COMMANDS = [TIMESTAMP_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);