import { GetGuildRoles } from "../discordclient.js";
import { respondWithCommandNotImplemented, respondWithComponentMessage } from "../discordresponsehelper.js";
import { insertMemberAchievement } from "../mongo.js";
import { ACHIEVEMENT_ROLES } from "./achievementRoles.js";
import { getUsersAchievements, isCustomIdAchievementRole } from "./achievements.js";
import { CustomIdToRoleNameMap, RoleNameToCustomIdMap, getRoleIdByName, getRoleNameById } from "./roleutils.js";

async function handleViewAchievements(res, userId, guildId){
    try{
        const userAchievements = await getUsersAchievements(userId, guildId);
        const roles = await GetGuildRoles(guildId);
        const allAchievements = ACHIEVEMENT_ROLES.map((achievement) => {
            const userAchievementIndex = userAchievements?.findIndex((customId) => achievement.custom_id === customId);
            achievement.userEarned =  userAchievementIndex > 0;
            const roleId = getRoleIdByName(roles, achievement.name);
            achievement.role_id = roleId;
            return achievement;
        });
        allAchievements.sort((a, b) => b.userEarned - a.userEarned);
        let message = '**Achievement Roles**';
        allAchievements.map((achievement) =>{
            message = message.concat(`\n${achievement.userEarned ? ':white_check_mark:' : ':x:'} <@&${achievement.role_id}>`);
        } );
        if(userAchievements === undefined || userAchievements.length === 0){
            message.concat('\nYou don\'t have any achievements. Use `/achievements achieve` to unlock an achievement badge and name color for your profile!');
        }
        respondWithComponentMessage(res, message, {onlyShowToCreator: true});
    } catch(err){
        console.error(err);
        respondWithComponentMessage(res, 'Something went wrong, please try again or contact a mod.', {onlyShowToCreator: true});
    }
}
async function handleAchieve(res, userId, guildId, achievement, proof){
    try{
        const achievements = await getUsersAchievements(userId, guildId);
        const roles = await GetGuildRoles(guildId);
        const roleName = getRoleNameById(roles, achievement);
        const customId = RoleNameToCustomIdMap[roleName];
        if(!isCustomIdAchievementRole(customId)){
            console.log(roleName, 'does not correspond to an achievement role. returning a message to the user', userId);
            return respondWithComponentMessage(res, `${roleName} is not an achievement, please choose a different role.`, {onlyShowToCreator: true});
        }
        const userHasAchievement = achievements.findIndex(achievement => achievement === customId) !== -1;
        console.log('user', userId, 'is achieving', customId);
        if(userHasAchievement){
            return respondWithComponentMessage(res, `You have already achieved ${roleName}\n Use the \`/profile\` command to show off your favorite achievement with a matching name color and badge`, {onlyShowToCreator: true});
        }
        await insertMemberAchievement(userId, guildId, customId);
        let message = `<@!${userId}> has earned <@&${achievement}>`;
        if(proof){
            message += `\n Check out the proof: ${proof}`;
        }
        message += '\n Use the `/profile` command to show off your favorite achievement with a matching name color and badge';
        return respondWithComponentMessage(res, message);
    } catch(err){
        console.error(err);
        respondWithComponentMessage(res, 'Something went wrong, please try again or contact a mod.', {onlyShowToCreator: true});
    }
}
export async function handleAchievementsCommand(res, userId, guildId, commandOptions){
  const {name, options} = commandOptions[0];
  switch(name){
    case 'view':
        console.log('returning earned achievements for user ', userId, 'in guild', guildId);
        return await handleViewAchievements(res, userId, guildId);
    case 'achieve':
        const achievement = options[0].value;
        const proof = options[1]?.value;
        console.log("user", userId, "is attempting to achieve role", achievement);
        return await handleAchieve(res, userId, guildId, achievement, proof);
    default:
        return respondWithComponentMessage(res, 'Oops, something went wrong. Please try again later.', {onlyShowToCreator: true});
  }
}