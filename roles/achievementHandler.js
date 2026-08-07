import { GetGuildRoles } from "../discordclient.js";
import { respondWithCommandNotImplemented, respondWithComponentMessage, updateChannelMessageAfterDefer, respondWithDeferMessage } from "../discordresponsehelper.js";
import { insertMemberAchievement } from "../mongo.js";
import { getUsersAchievements, isCustomIdAchievementRole } from "./achievements.js";
import { getRoleIdByName, getRoleNameById } from "./roleutils.js";
import { getAchievementDefs, getRoleNameByCustomId, getCustomIdByRoleName } from "./effectiveCatalog.js";

async function handleViewAchievements(interactionToken, userId, guildId){
    try{
        const userAchievements = await getUsersAchievements(userId, guildId);
        const roles = await GetGuildRoles(guildId);
        if(!Array.isArray(roles)){
            console.warn('Expected guild roles array but got:', roles, 'for guild', guildId);
        }
        const missingAchievementRoles = [];
        const achievementDefs = await getAchievementDefs();
        const allAchievements = achievementDefs.map((achievement) => {
            const userAchievementIndex = userAchievements?.findIndex((customId) => achievement.custom_id === customId);
            achievement.userEarned =  userAchievementIndex >= 0;
            const roleId = getRoleIdByName(roles, achievement.name);
            if(!roleId){
                missingAchievementRoles.push({
                    custom_id: achievement.custom_id,
                    short_name: achievement.short_name,
                    role_name: achievement.name
                });
            }
            achievement.role_id = roleId;
            return achievement;
        });
        if(missingAchievementRoles.length > 0){
            console.warn(
                'Missing managed achievement roles in guild. User:',
                userId,
                'Guild:',
                guildId,
                'Count:',
                missingAchievementRoles.length,
                'Roles:',
                missingAchievementRoles
            );
        }
        allAchievements.sort((a, b) => b.userEarned - a.userEarned);
        let message = '**Achievement Roles**';
        allAchievements.map((achievement) =>{
            const roleDisplay = achievement.role_id ? `<@&${achievement.role_id}>` : `${achievement.short_name} (role missing in server)`;
            message = message.concat(`\n${achievement.userEarned ? ':white_check_mark:' : ':x:'} ${roleDisplay}`);
        } );
        if(userAchievements === undefined || userAchievements.length === 0){
            message = message.concat('\nYou don\'t have any achievements. Use `/achievements achieve` to unlock an achievement badge and name color for your profile!');
        }
        await updateChannelMessageAfterDefer(interactionToken, message, {onlyShowToCreator: true});
    } catch(err){
        console.error(err);
        await updateChannelMessageAfterDefer(interactionToken, 'Something went wrong, please try again or contact a mod.', {onlyShowToCreator: true});
    }
}
async function handleAchieve(interactionToken, userId, guildId, achievement, proof){
    try{
        const customId = await getCustomIdFromRoleId(guildId, achievement);
        if(!(await isCustomIdAchievementRole(customId))){
            console.log(customId, 'does not correspond to an achievement role. returning a message to the user', userId);
            return updateChannelMessageAfterDefer(interactionToken, `<@&${achievement}> is not an achievement, please choose a different role.`, {onlyShowToCreator: true});
        }
        const roleName = await getRoleNameByCustomId(customId);
        const achievements = await getUsersAchievements(userId, guildId);
        const userHasAchievement = achievements.findIndex(achievement => achievement === customId) !== -1;
        console.log('user', userId, 'is achieving', customId);
        if(userHasAchievement){
            return updateChannelMessageAfterDefer(interactionToken, `You have already achieved ${roleName}\n Use the \`/profile\` command to show off your favorite achievement with a matching name color and badge`, {onlyShowToCreator: true});
        }
        const achievementDefs = await getAchievementDefs();
        const requirements = achievementDefs.find(a => a.custom_id === customId)?.requirements;
        if(requirements && requirements.length > 0){
            for(let requirement in requirements){
                if(achievements.findIndex(achievement => achievement === requirement) === -1) {
                    console.log('user', userId, 'does not meet the requirements for', customId, "they need to earn", roleName);
                    return updateChannelMessageAfterDefer(interactionToken, `You do not meet the requirements for this role. Try again after achieving ${roleName}.`, {onlyShowToCreator: true});
                }
            }
        }
        await insertMemberAchievement(userId, guildId, customId);
        let message = `<@!${userId}> has earned <@&${achievement}>`;
        if(proof){
            message += `\n Check out the proof: ${proof}`;
        }
        message += '\n Use the `/profile` command to show off your favorite achievement with a matching name color and badge';
        return updateChannelMessageAfterDefer(interactionToken, message);
    } catch(err){
        console.error(err);
        updateChannelMessageAfterDefer(interactionToken, 'Something went wrong, please try again or contact a mod.', {onlyShowToCreator: true});
    }
}
export async function handleAchievementsCommand(res, userId, guildId, commandOptions, interactionToken){
    const {name, options} = commandOptions[0];
    switch(name){
        case 'view':
            console.log('acking the interaction then returning earned achievements for user ', userId, 'in guild', guildId);
            //ack interaction then handle and update afterwards
            respondWithDeferMessage(res);
            return await handleViewAchievements(interactionToken, userId, guildId);
        case 'achieve':
            //ack interaction then handle and update afterwards
            respondWithDeferMessage(res, false);
            const achievement = options[0].value;
            const proof = options[1]?.value;
            console.log("user", userId, "is attempting to achieve role", achievement);
            return await handleAchieve(interactionToken, userId, guildId, achievement, proof);
        default:
            return await respondWithComponentMessage(res, 'Oops, something went wrong. Please try again later.', {onlyShowToCreator: true});
    }
}
export async function getCustomIdFromRoleId(guildId, achievement){
    const roles = await GetGuildRoles(guildId);
    const roleName = getRoleNameById(roles, achievement);
    if(!roleName){
        console.warn('Could not find role name for role ID', achievement, 'in guild', guildId);
    }
    const customId = await getCustomIdByRoleName(roleName);
    if(roleName && !customId){
        console.warn('No managed custom ID mapping for role name', roleName, 'in guild', guildId);
    }
    console.log(roleName, customId);
    return customId;
}