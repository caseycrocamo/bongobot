import 'dotenv/config';
import { GetGuildRoles, GetMember, UpdateInteractionResponse } from '../discordclient.js';
import { removeUsersCurrentRole, setUsersActiveRole, setUsersActiveRoleFromCustomId } from '../roles/roles.js';
import { achievement_name_dropdown, choose_achievement, choose_crafting, choose_profession, elementalistenjoyer, engineerenjoyer, grimreaper, guardianenjoyer, heroicjpracer, mesmerenjoyer, necromancerenjoyer, profile_choice_dropdown, profile_name_dropdown, rangerenjoyer, reigningjpchamp, remove_all, revenantenjoyer, thiefenjoyer, warriorenjoyer, wildcard } from '../customids.js';
import { getMemberCommandState, getMemberAchievement, insertMemberCommandState, insertMemberAchievement, removeMemberCommandState } from '../mongo.js';
import { getUsersAchievements } from '../roles/achievements.js';
import { ACHIEVEMENT_ROLES } from '../roles/achievementRoles.js';
import { memberCanManageRoles } from '../member.js';
import { PROFESSION_ROLES } from '../roles/professionRoles.js';
import { respondWithComponentMessage, respondWithUpdateMessage, respondWithCommandNotImplemented, respondWithDeferMessage, respondWithDeferUpdate, updateChannelMessageAfterDefer } from '../discordresponsehelper.js';
import { CRAFTING_ROLES } from './craftingRoles.js';
import { getCustomIdFromRoleId } from './achievementHandler.js';
export function respondWithCraftingChoices(res){
  const message = 'Show off your crafting prowess with a shiny new name color and crafting icon! Pick a discipline:';
  const options = CRAFTING_ROLES.map((role) => {
    return {
        type: 2,
        label: role.short_name,
        style: 1,
        custom_id: role.custom_id
    }
  });
  const components = [
    {
      type: 1,
      components: options
    },
  ];
  return respondWithUpdateMessage(res, message, {components, onlyShowToCreator: true});
}
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
export function handleHelpCommand(res){
    const message = `Discord messages have a limit of 2000 characters. See the full documentation on the readme: https://github.com/caseycrocamo/bongobot/blob/main/README.md`;
  return respondWithComponentMessage(res, message, {onlyShowToCreator: true});
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
              label: "Choose a Crafting Discipline",
              style: 1,
              custom_id: choose_crafting
          },
      ]
    },
    {
      type: 1,
      components: [
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
    const response = respondWithUpdateMessage(res, 'Updating user\'s profile. Please hold...');
    const interactionToken = response.req.body.token;
    try{
        const grantAchievementState = await getMemberCommandState(callingMember.user.id);
        const targetId = await getTargetIdFromState(grantAchievementState, callingMember.user.id);
        const member = await GetMember(guild_id, targetId);
        console.log(`user ${callingMember.user.id} is setting a profile (${role}) in guild ${guild_id} for user ${targetId}`)
        //handle no member found
        const customId = await getCustomIdFromRoleId(guild_id, role);
        if(customId === undefined || customId === null){
            console.log(`member (${member}) attempted to set their role to a non managed role (${role}). Exiting early.`);
            return await updateChannelMessageAfterDefer(interactionToken, 'Unable to set profile to an unmanaged role. Try again with a different role.');
        }
        await setUsersActiveRole(member, guild_id, role);
        return await updateChannelMessageAfterDefer(interactionToken, 'Successfully updated member\'s role!');
    } catch(err){
        console.error(err);
        return await updateChannelMessageAfterDefer(interactionToken, 'Something went wrong. Try again later or contact a mod.')
    }
}
export async function handleAssignAchievement(res, callingMember, guild_id, achievement_id){
    //ack interaction then handle and update afterwards
    const response = await respondWithUpdateMessage(res, 'Attempting to assign achievement. Please hold...');
    const interactionToken = response.req.body.token;
    try{
        const grantAchievementStates = await getMemberCommandState(callingMember.user.id);
        const targetUserId = await getTargetIdFromState(grantAchievementStates, callingMember.user.id);
        const existingMemberAchievement = await getMemberAchievement(targetUserId, guild_id, achievement_id);
        if(existingMemberAchievement !== undefined && existingMemberAchievement[0]){
            console.log('User (id: ', targetUserId, ') already has the achievement ', achievement_id, '. Exiting early.');
            return updateChannelMessageAfterDefer(interactionToken, 'User already has the assigned achievement.')
        }
        await insertMemberAchievement(targetUserId, guild_id, achievement_id);
        return updateChannelMessageAfterDefer(interactionToken, 'Achievement assigned successfully.');
    } catch(err){
        console.error(err);
        return updateChannelMessageAfterDefer(interactionToken, 'Something went wrong. Try again later or contact a mod.')
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
    const response = respondWithUpdateMessage(res, 'Updating your server profile. Please hold...');
    const interactionToken = response.req.body.token;
    try{
      await setUsersActiveRoleFromCustomId(member, guild_id, role);
      return updateChannelMessageAfterDefer(interactionToken, 'Successfully updated your active role!');
    } catch(err){
        console.log(err);
      return updateChannelMessageAfterDefer(interactionToken, 'Sorry, I was unable to update your role. Try again or contact a local mod.');
    }
}

export async function respondWithAchievementChoices(res, userId, guildId){
    try{
        const achievementRolesMap = {};
        ACHIEVEMENT_ROLES.map((achievementRole) => achievementRolesMap[achievementRole.custom_id] = achievementRole.short_name);
        const userAchievements = await getUsersAchievements(userId, guildId);
        const message = 'Which achievement would you like to show off? It will set the color of your name and your badge in this server.'
        let options = [
            {
                label: "Wild Card",
                value: wildcard,
                description: "Has every profession at 80 and a new main every week."
            },
        ];
        if(userAchievements && userAchievements.length > 0){
            console.log('found user achievements. Adding them to the achievement choices. Achievements: ', userAchievements);
            userAchievements.map((customId) => 
            {
                const achievement = ACHIEVEMENT_ROLES.find(role => role.custom_id === customId);
                options.push(
                {
                    label: achievement.short_name,
                    value: achievement.custom_id,
                    description: achievement.description
                })
            });
        }
        options.sort((a, b) => a.label.localeCompare(b.label));
        const components = [
            {
                type: 1,
                components: [
                    {
                    type: 3,
                        custom_id: profile_choice_dropdown,
                        options,
                        placeholder: "Choose an Achievement",
                        min_values: 1,
                        max_values: 1
            }]
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
        let options = [];
        ACHIEVEMENT_ROLES.map((achievement) => 
            options.push(
            {
                label: achievement.short_name,
                value: achievement.custom_id,
                description: achievement.description
            })
        );
        options.sort((a, b) => a.label.localeCompare(b.label));
        const components = [
            {
                type: 1,
                components: [
                    {
                    type: 3,
                        custom_id: achievement_name_dropdown,
                        options,
                        placeholder: "Choose an Achievement",
                        min_values: 1,
                        max_values: 1
            }]
            },
        ];
        return await respondWithComponentMessage(res, 'Which achievement would you like to assign?', {onlyShowToCreator: true,components})
    } catch(err){
        console.error(err);
        return await respondWithComponentMessage(res, 'Something went wrong. Try again later or contact a mod.', {onlyShowToCreator: true});
    }
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
    const components = [
        {
            type: 1,
            components: [
                {
                  type: 6,
                  custom_id: profile_name_dropdown,
                  placeholder: "Choose a Profile"
            }]
      },
  ];
    return await respondWithComponentMessage(res, 'Which profile would you like to assign?', {onlyShowToCreator: true, components})
}
async function getTargetIdFromState(state, userId){
    console.log('state for userId: ',state);
    const latestState = state.pop();
    if(latestState === undefined){
        console.error('no state found for user: ', userId, ' when attempting to assign achievement');
        return respondWithUpdateMessage(res, 'Something went wrong. Try again later or contact a mod.');
    }
    await removeMemberCommandState(userId)
    return latestState.targetId;
}