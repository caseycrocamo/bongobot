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
        description:"use the format: in 9 hours 30 minutes or in 9h 10m",
        required: true
      }
    ]
};

export const ALL_COMMANDS = [TIMESTAMP_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);