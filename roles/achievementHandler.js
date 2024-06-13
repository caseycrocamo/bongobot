import { GetGuildRoles } from "../discordclient.js";
import { respondWithComponentMessage } from "../discordresponsehelper.js";
import { getUsersAchievements } from "./achievements.js";
import CustomIdToRoleNameMap, { getRoleIdByName } from "./roleutils.js";

async function handleViewAchievements(res, userId, guildId){
    try{
        const achievements = await getUsersAchievements(userId, guildId);
        if(achievements === undefined || achievements.length === 0){
            respondWithComponentMessage(res, 'You don\'t have any achievements. Use `/achievement achieve` to unlock an achievement badge and name color for your profile!', {onlyShowToCreator: true});
        }
        const roles = await GetGuildRoles(guildId);
        let message = '**Earned Achievement Roles**';
        achievements.map((achievement) =>{
            const roleName = CustomIdToRoleNameMap[achievement];
            const roleId = getRoleIdByName(roles, roleName);
            message = message.concat(`\n <@&${roleId}>`);
        } );
        respondWithComponentMessage(res, message, {onlyShowToCreator: true});
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
        return handleCommandNotImplemented(res);
    default:
        return respondWithComponentMessage(res, 'Oops, something went wrong. Please try again later.', {onlyShowToCreator: true});
  }
}