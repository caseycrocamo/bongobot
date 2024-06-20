import { GetGuildRoles } from "../discordclient.js";
import { respondWithCommandNotImplemented, respondWithComponentMessage } from "../discordresponsehelper.js";
import { insertMemberAchievement } from "../mongo.js";
import { getUsersAchievements } from "./achievements.js";
import { CustomIdToRoleNameMap, RoleNameToCustomIdMap, getRoleIdByName, getRoleNameById } from "./roleutils.js";

async function handleViewAchievements(res, userId, guildId){
    try{
        const achievements = await getUsersAchievements(userId, guildId);
        const roles = await GetGuildRoles(guildId);
        let message = '**Earned Achievement Roles**';
        if(achievements === undefined || achievements.length === 0){
            message.concat('\nYou don\'t have any achievements. Use `/achievement achieve` to unlock an achievement badge and name color for your profile!');
        }
        else{
            achievements.map((achievement) =>{
                const roleName = CustomIdToRoleNameMap[achievement];
                const roleId = getRoleIdByName(roles, roleName);
                message = message.concat(`\n <@&${roleId}>`);
            } );
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
        const userHasAchievement = achievements.findIndex(achievement => achievement === customId) !== -1;
        console.log('user', userId, 'is achieving', customId);
        if(userHasAchievement){
            return respondWithComponentMessage(res, `You have already achieved ${roleName}\n Use the `/profile` command to show off your favorite achievement with a matching name color and badge`, {onlyShowToCreator: true});
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