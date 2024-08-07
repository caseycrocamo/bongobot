export const PROFILE_COMMAND = {
    name: 'profile',
    description: 'customize your appearance in this server with a name color and badge',
    type: 1
};
export const HELP_COMMAND = {
    name: 'help',
    description: 'get info on how to use the commands',
    type: 1
};
export const ACHIEVEMENT_COMMAND = {
    name: 'achievements',
    description: 'view achievements and unlock titles for your profile',
    type: 1,
    options: [
        {
            name: 'view',
            description: 'displays all available achievements and your status in achieving them',
            type: 1
        },
        {
            name: 'achieve',
            description: 'complete an achievement and unlock a title for your profile!',
            type: 1,
            options: [
                {
                    type: 8,
                    name: 'achievement',
                    description:"name of the achievement to complete",
                    required: true
                },
                {
                    type: 3,
                    name: 'proof',
                    description:"proof of completion - dps logs, link to a screenshot, etc.",
                    required: false
                }
            ]
        }

    ]
};
export const TIMESTAMP_COMMAND = {
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
export const GRANT_MEMBER_ACHIEVEMENT_COMMAND = {
    name: 'Grant Achievement',
    type: 2
}
export const SET_MEMBER_PROFILE_COMMAND = {
    name: 'Set Profile',
    type: 2
}

export const ALL_COMMANDS = [TIMESTAMP_COMMAND, PROFILE_COMMAND, ACHIEVEMENT_COMMAND, GRANT_MEMBER_ACHIEVEMENT_COMMAND, SET_MEMBER_PROFILE_COMMAND, HELP_COMMAND];