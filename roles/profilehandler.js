import 'dotenv/config';
import { GetGuildRoles, GetMember, UpdateInteractionResponse } from '../discordclient.js';
import { removeUsersCurrentRole, setUsersActiveRole, setUsersActiveRoleFromCustomId } from '../roles/roles.js';
import { achievement_name_dropdown, grant_achievement_category_dropdown, choose_achievement, choose_crafting, choose_profession, profile_choice_dropdown, profile_name_dropdown, remove_all } from '../customids.js';
import { getMemberAchievement, insertMemberAchievement } from '../mongo.js';
import { getUsersAchievements } from '../roles/achievements.js';
import { getAchievementDefs, getProfessionDefs, getCraftingDefs, getAchievementCategories } from './effectiveCatalog.js';
import { memberCanManageRoles } from '../member.js';
import { respondWithComponentMessage, respondWithUpdateMessage, respondWithCommandNotImplemented, respondWithDeferMessage, respondWithDeferUpdate, updateChannelMessageAfterDefer } from '../discordresponsehelper.js';
import { getCustomIdFromRoleId } from './achievementHandler.js';
export async function respondWithCraftingChoices(res){
  const message = 'Show off your crafting prowess with a shiny new name color and crafting icon! Pick a discipline:';
  const defs = await getCraftingDefs();
  const options = defs.map((role) => {
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
export async function respondWithProfessionChoices(res){
  const message = 'Show off your favorite profession with a shiny new name color and profession icon! Pick a profession:';
  const defs = await getProfessionDefs();
  const components = [];
  for(let i = 0; i < defs.length; i += 3){
    const chunk = defs.slice(i, i + 3).map((def) => ({
      type: 2,
      label: def.short_name.replace(/\s+Enjoyer$/, ''),
      style: 1,
      custom_id: def.custom_id
    }));
    components.push({ type: 1, components: chunk });
  }
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
export async function handleSetProfile(res, callingMember, guild_id, role, targetId, interactionToken){
    respondWithUpdateMessage(res, 'Updating user\'s profile. Please hold...');
    try{
        // Secondary authorization check — primary enforcement is via default_member_permissions on the command definition.
        const authorized = await memberCanManageRoles(callingMember);
        if(!authorized){
            console.warn('User ', callingMember.user.id, ' does not have permission to set profiles.');
            return await updateChannelMessageAfterDefer(interactionToken, 'You don\'t have permission to perform this action.');
        }
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
export async function handleAssignAchievement(res, callingMember, guild_id, achievement_id, targetUserId, interactionToken){
    //ack interaction then handle and update afterwards
    respondWithUpdateMessage(res, 'Attempting to assign achievement. Please hold...');
    try{
        // Secondary authorization check — primary enforcement is via default_member_permissions on the command definition.
        const authorized = await memberCanManageRoles(callingMember);
        if(!authorized){
            console.warn('User ', callingMember.user.id, ' does not have permission to grant achievements.');
            return updateChannelMessageAfterDefer(interactionToken, 'You don\'t have permission to perform this action.');
        }
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
export async function handleProfileUpdate(res, member, guild_id, role, interactionToken){
    respondWithUpdateMessage(res, 'Updating your server profile. Please hold...');
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
        const achievementDefs = await getAchievementDefs();
        const userAchievements = await getUsersAchievements(userId, guildId);
        const message = 'Which achievement would you like to show off? It will set the color of your name and your badge in this server.'
        const wildcardDef = achievementDefs.find(d => d.custom_id === 'wildcard');
        let options = wildcardDef ? [
            {
                label: wildcardDef.short_name,
                value: wildcardDef.custom_id,
                description: wildcardDef.description
            },
        ] : [];
        if(userAchievements && userAchievements.length > 0){
            console.log('found user achievements. Adding them to the achievement choices. Achievements: ', userAchievements);
            userAchievements.map((customId) =>
            {
                const achievement = achievementDefs.find(role => role.custom_id === customId);
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
        const achievementDefs = await getAchievementDefs();
        const order = await getAchievementCategories();
        const categories = order.map(name => ({ name, achievements: achievementDefs.filter(d => d.category === name) })).filter(c => c.achievements.length > 0);
        const categoryOptions = categories.map(cat => ({
            label: cat.name,
            value: cat.name,
            description: `${cat.achievements.length} achievement${cat.achievements.length !== 1 ? 's' : ''}`
        }));
        const components = [
            {
                type: 1,
                components: [{
                    type: 3,
                    custom_id: `${grant_achievement_category_dropdown}:${target_id}`,
                    options: categoryOptions,
                    placeholder: 'Select a category',
                    min_values: 1,
                    max_values: 1
                }]
            }
        ];
        return await respondWithComponentMessage(res, 'Which category does the achievement belong to?', {onlyShowToCreator: true, components});
    } catch(err){
        console.error(err);
        return await respondWithComponentMessage(res, 'Something went wrong. Try again later or contact a mod.', {onlyShowToCreator: true});
    }
}

export async function handleGrantAchievementCategorySelect(res, callingMember, guild_id, selectedCategory, targetId, token){
    try {
        const authorized = await memberCanManageRoles(callingMember);
        if(!authorized){
            console.warn('User ', callingMember.user.id, " does not have permission to grant achievements.");
            return await respondWithUpdateMessage(res, 'You don\'t have permission to perform this action.', {onlyShowToCreator: true});
        }
        const achievementDefs = await getAchievementDefs();
        const categoryAchievements = achievementDefs.filter(d => d.category === selectedCategory);
        if(categoryAchievements.length === 0){
            return await respondWithUpdateMessage(res, `Unknown category: ${selectedCategory}`, {onlyShowToCreator: true});
        }
        const options = categoryAchievements.map(achievement => ({
            label: achievement.short_name,
            value: achievement.custom_id,
            description: achievement.description
        })).sort((a, b) => a.label.localeCompare(b.label));
        const components = [
            {
                type: 1,
                components: [{
                    type: 3,
                    custom_id: `${achievement_name_dropdown}:${targetId}`,
                    options,
                    placeholder: `Choose a ${selectedCategory} Achievement`,
                    min_values: 1,
                    max_values: 1
                }]
            }
        ];
        return respondWithUpdateMessage(res, `Which **${selectedCategory}** achievement would you like to assign?`, {onlyShowToCreator: true, components});
    } catch(err){
        console.error(err);
        return respondWithUpdateMessage(res, 'Something went wrong. Try again later or contact a mod.', {onlyShowToCreator: true});
    }
}
export async function handleSetProfileCommand(res, callingMember, target_id){
    try {
       const authorized = await memberCanManageRoles(callingMember);
       if(!authorized){
         console.warn('User ', callingMember.user.id, " does not have permission to set profiles.");
         return await respondWithComponentMessage(res, 'You don\'t have permission to perform this action. You must be able to Manage Roles in this server.', {onlyShowToCreator: true});
       }
       const components = [
           {
               type: 1,
               components: [
                   {
                     type: 6,
                     custom_id: `${profile_name_dropdown}:${target_id}`,
                     placeholder: "Choose a Profile"
               }]
         },
     ];
       return await respondWithComponentMessage(res, 'Which profile would you like to assign?', {onlyShowToCreator: true, components})
    } catch(err){
       console.log(err);
       return await respondWithComponentMessage(res, 'Something went wrong. Try again later or contact a mod.', {onlyShowToCreator: true});
    }
}
