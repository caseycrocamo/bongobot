import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
};

const TIMESTAMP_COMMAND = {
    name: 'timestamp',
    description: 'create a relative unix timestamp',
    type: 1,
};

const ALL_COMMANDS = [TEST_COMMAND, TIMESTAMP_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);