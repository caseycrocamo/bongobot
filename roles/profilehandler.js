import 'dotenv/config';
import { GetMember } from '../discordclient.js';
import setUsersActiveRole, { removeUsersCurrentRole } from '../roles/roles.js';
import { achievement_name_dropdown, choose_achievement, choose_profession, elementalistenjoyer, engineerenjoyer, grimreaper, guardianenjoyer, mesmerenjoyer, necromancerenjoyer, profile_name_dropdown, rangerenjoyer, reigningjpchamp, remove_all, revenantenjoyer, scourgemd, thiefenjoyer, warriorenjoyer, wildcard } from '../customids.js';
import { getMemberCommandState, getMemberAchievement, insertMemberCommandState, insertMemberAchievement, removeMemberCommandState } from '../mongo.js';
import { getUsersAchievements } from '../roles/achievements.js';
import { ACHIEVEMENT_ROLES } from '../roles/achievementRoles.js';
import { memberCanManageRoles } from '../member.js';
import { PROFESSION_ROLES } from '../roles/professionRoles.js';
import { respondWithComponentMessage, respondWithUpdateMessage, respondWithCommandNotImplemented } from '../discordresponsehelper.js';
export function respondWithProfessionChoices(res){
  const message = 'Show off your favorite profession with a shiny new name color and profession icon! Pick a profession:';
  const components = [
    {
      type: 1,
      components: [
          {
              type: 2,
              label: "Elementalist",
              style: 1,
              custom_id: elementalistenjoyer
          },
          {
              type: 2,
              label: "Mesmer",
              style: 1,
              custom_id: mesmerenjoyer
          },
          {
              type: 2,
              label: "Necromancer",
              style: 1,
              custom_id: necromancerenjoyer
          },
      ]
    },
    {
      type: 1,
      components: [
          {
              type: 2,
              label: "Engineer",
              style: 1,
              custom_id: engineerenjoyer
          },
          {
              type: 2,
              label: "Ranger",
              style: 1,
              custom_id: rangerenjoyer
          },
          {
              type: 2,
              label: "Thief",
              style: 1,
              custom_id: thiefenjoyer
          },
      ]
    },
    {
      type: 1,
      components: [
          {
              type: 2,
              label: "Guardian",
              style: 1,
              custom_id: guardianenjoyer
          },
          {
              type: 2,
              label: "Revenant",
              style: 1,
              custom_id: revenantenjoyer
          },
          {
              type: 2,
              label: "Warrior",
              style: 1,
              custom_id: warriorenjoyer
          },
      ]
    }
  ];
  return respondWithUpdateMessage(res, message, {components, onlyShowToCreator: true});
}
export function handleProfileCommand(res){
  const message = 'What would you like to do?';
  const components = [
    {
      type: 1,
      components: [
          {
              type: 2,
              label: "Remove Role",
              style: 1,
              custom_id: remove_all
          },
          {
              type: 2,
              label: "Choose a Profession",
              style: 1,
              custom_id: choose_profession
          },
          {
              type: 2,
              label: "Show off Achievements",
              style: 1,
              custom_id: choose_achievement
          },
      ]
    },
  ]
  return respondWithComponentMessage(res, message, {components, onlyShowToCreator: true});
}
export async function handleSetProfile(res, callingMember, guild_id, role){
    try{
        const grantAchievementState = await getMemberCommandState(callingMember.user.id);
        console.log('found state object: ', grantAchievementState);
        //handle null state
        await removeMemberCommandState(callingMember.user.id)
        const targetId = grantAchievementState[0].targetId;
        const member = await GetMember(guild_id, targetId);
        console.log(`user ${callingMember.user.id} is setting a profile (${role}) in guild ${guild_id} for user ${targetId}`)
        //handle no member found
        await setUsersActiveRole(member, guild_id, role);
        return respondWithUpdateMessage(res, 'Successfully updated member\'s role!');
    } catch(err){
        console.error(err);
        respondWithUpdateMessage(res, 'Something went wrong. Try again later or contact a mod.')
    }
}
export async function handleAssignAchievement(res, callingMember, guild_id, achievement_id){
    try{
        const grantAchievementState = await getMemberCommandState(callingMember.user.id);
        await removeMemberCommandState(callingMember.user.id)
        const existingMemberAchievement = await getMemberAchievement(grantAchievementState[0].targetId, guild_id, achievement_id);
        if(existingMemberAchievement[0]){
            console.log('User (id: ', grantAchievementState[0].targetId, ') already has the achievement ', achievement_id, '. Exiting early.');
            return respondWithUpdateMessage(res, 'User already has the assigned achievement.')
        }
        await insertMemberAchievement(grantAchievementState[0].targetId, guild_id, achievement_id);
        return respondWithUpdateMessage(res, 'Achievement assigned successfully.');
    } catch(err){
        console.error(err);
        respondWithUpdateMessage(res, 'Something went wrong. Try again later or contact a mod.')
    }
}
export async function handleRemoveRole(res, member, guild_id){
    try{
      const roleRemoved = await removeUsersCurrentRole(member, guild_id);
      const message = roleRemoved ? 'Successfully removed your active role.' : 'No role found to remove. If you believe this is an error contact a mod.';
      return respondWithUpdateMessage(res, message);
    } catch(err) {
      console.error(err);
      return respondWithUpdateMessage(res, 'Sorry, I was unable to update your role. Try again or contact a local mod.');
    }
}
export async function handleProfileUpdate(res, member, guild_id, role){
    try{
      await setUsersActiveRole(member, guild_id, role);
      return respondWithUpdateMessage(res, 'Successfully updated your active role!');
    } catch(err){
        console.log(err);
      return respondWithUpdateMessage(res, 'Sorry, I was unable to update your role. Try again or contact a local mod.');
    }
}

export async function respondWithAchievementChoices(res, userId, guildId){
    try{
        const achievementRolesMap = {};
        ACHIEVEMENT_ROLES.map((achievementRole) => achievementRolesMap[achievementRole.custom_id] = achievementRole.name);
        const userAchievements = await getUsersAchievements(userId, guildId);
        const message = 'Which achievement would you like to show off? It will set the color of your name and your badge in this server.'
        const achievementChoices = [
            {
                type: 2,
                label: "Wildcard",
                style: 1,
                custom_id: wildcard
            },
        ];
        if(userAchievements){
            console.log('found user achievements. Adding them to the achievement choices.');
            userAchievements.map((achievement) => achievementChoices.push({
                type: 2,
                label: achievementRolesMap[achievement],
                style: 1,
                custom_id: achievement
            }))
        }

        const components = [
            {
            type: 1,
            components: achievementChoices
            },
        ];
        return respondWithUpdateMessage(res, message, { components});
    } catch(err){
        console.log(err);
      return respondWithUpdateMessage(res, 'Sorry, I was unable to update your role. Try again or contact a local mod.');
    }
}
export async function handleGrantAchievementCommand(res, callingMember, target_id){
    try {
        const authorized = await memberCanManageRoles(callingMember);
        if(!authorized){
          console.warn('User ', callingMember.user.id, " does not have permission to grant achievements.");
          return await respondWithComponentMessage(res, 'You don\'t have permission to perform this action. You must be able to Manage Roles in this server.', {onlyShowToCreator: true});
        }
        await insertMemberCommandState(callingMember.user.id, target_id);
    } catch(err){
        console.error(err);
        return await respondWithComponentMessage(res, 'Something went wrong. Try again later or contact a mod.', {onlyShowToCreator: true});
    }
    const components = [
        {
            type: 1,
            components: [
                {
                type: 3,
                    custom_id: achievement_name_dropdown,
                    options:[
                        {
                            label: "Reigning Jumping Puzzle Champion",
                            value: reigningjpchamp,
                            description: "Winner of the guild jumping puzzle race!",
                        },
                        {
                            label: "Grim Reaper",
                            value: grimreaper,
                            description: "Has achieved 25k DPS on a raid / strike boss as a Reaper.",
                        },
                        {
                            label: "Scourge MD",
                            value: scourgemd,
                            description: "resurrected 30 players in a single fight.",
                        },
                    ],
                    placeholder: "Choose an Achievement",
                    min_values: 1,
                    max_values: 1
        }]
        },
    ];
    return await respondWithComponentMessage(res, 'Which achievement would you like to assign?', {onlyShowToCreator: true,components})
}
export async function handleSetProfileCommand(res, callingMember, target_id){
    try {
        const authorized = await memberCanManageRoles(callingMember);
        if(!authorized){
          console.warn('User ', callingMember.user.id, " does not have permission to set profiles.");
          return await respondWithComponentMessage(res, 'You don\'t have permission to perform this action. You must be able to Manage Roles in this server.', {onlyShowToCreator: true});
        }
        await insertMemberCommandState(callingMember.user.id, target_id);
    } catch(err){
        console.log(err);
        return await respondWithComponentMessage(res, 'Something went wrong. Try again later or contact a mod.', {onlyShowToCreator: true});
    }
    const professionOptions = PROFESSION_ROLES.map((role) => {
        return {
                  label: role.name,
                  value: role.custom_id
                };
    })
    const achievementOptions = ACHIEVEMENT_ROLES.map((role) => {
        return {
                  label: role.name,
                  value: role.custom_id
                };
    })
    const options = [...achievementOptions, ...professionOptions];
    const components = [
        {
            type: 1,
            components: [
                {
                  type: 3,
                  custom_id: profile_name_dropdown,
                  options,
                  placeholder: "Choose a Profile",
                  min_values: 1,
                  max_values: 1
      }]
      },
  ];
    return await respondWithComponentMessage(res, 'Which profile would you like to assign?', {onlyShowToCreator: true,components})
}
export async function handleAchievementsCommand(res, commandOptions){
  let message = '';
  const {name, options} = commandOptions[0];
  return handleCommandNotImplemented(res);
  switch(name){
    case 'view':
        break;
    case 'achieve':
        break;
    default:
        message = 'Oops, something went wrong. Please try again later.'
        break;
  }
  return respondWithComponentMessage(res, message, {onlyShowToCreator: true});
}