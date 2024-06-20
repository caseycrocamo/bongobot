import { getAllMemberAchievements, insertMemberAchievement } from "../mongo.js";
import 'dotenv/config';
import { ACHIEVEMENT_ROLES } from "./achievementRoles.js";
export async function getUsersAchievements(userId, guildId){
    const userAchievementDocuments = await getAllMemberAchievements(userId, guildId);
    return userAchievementDocuments?.map((userAchivement) => userAchivement.achievementId);
}
export function isCustomIdAchievementRole(customId){
    return ACHIEVEMENT_ROLES.findIndex(role => role.custom_id === customId) !== -1;
}