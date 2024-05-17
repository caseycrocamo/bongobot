import 'dotenv/config';
import { InstallGlobalCommands, InstallGuildCommands } from './utils.js';

const PROFILE_COMMAND = {
    name: 'profile',
    description: 'show off your favorite gw2 class with a matching name color and badge in this server',
    type: 1
};
const TIMESTAMP_COMMAND = {
    name: 'timestamp',
    description: 'create an organic, free range timestamp that discord loves to maunch',
    type: 1,
    options: [
        {
            name: 'relative',
            description: 'create a timestamp that counts down in real time from a relative time',
            type: 1,
            options: [
                {
                    type: 3,
                    name: 'how_long',
                    description:"use the format: in 9 hours 30 minutes or in 9h 10m",
                    required: true
                }
            ]
        },
        {
            name: 'absolute',
            description: 'create a timestamp with all the fixens from a date and time',
            type: 1,
            options: [
                {
                    type: 3,
                    name: 'date',
                    description:"use the format: 9/09/24",
                    required: true
                },
                {
                    type: 3,
                    name: 'time',
                    description:"use the format: 9:00pm",
                    required: true
                },
                {
                    type: 3,
                    name: 'timezone',
                    description:"use the format: PDT",
                    choices:[
                        {
                            name:'Pacific',
                            value:'-0700'
                        },
                        {
                            name:'Mountain',
                            value:'-0600'
                        },
                        {
                            name:'Central',
                            value:'-0500'
                        },
                        {
                            name:'Eastern',
                            value:'-0400'
                        },
                        {
                            name:'UTC',
                            value:'0000'
                        },
                    ],
                    required: true
                },
                {
                    type: 3,
                    name: 'type',
                    description:"how it should be displayed",
                    choices:[
                        {
                            name:'relative',
                            value:'R'
                        },
                        {
                            name:'date',
                            value:'D'
                        },
                        {
                            name:'time',
                            value:'t'
                        },
                        {
                            name:'date + time',
                            value:'f'
                        },
                    ],
                    required: false
                },
            ]
        },
    ]
};


export const ALL_COMMANDS = [TIMESTAMP_COMMAND, PROFILE_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
InstallGuildCommands(process.env.APP_ID, process.env.GUILD_ID, ALL_COMMANDS);