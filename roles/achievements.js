import { getAllMemberAchievements, insertMemberAchievement } from "../mongo.js";
import 'dotenv/config';
import { isCustomIdAchievementRole as catalogIsCustomIdAchievementRole } from "./effectiveCatalog.js";
export async function getUsersAchievements(userId, guildId){
    const userAchievementDocuments = await getAllMemberAchievements(userId, guildId);
    return userAchievementDocuments?.map((userAchivement) => userAchivement.achievementId);
}
export async function isCustomIdAchievementRole(customId){
    return await catalogIsCustomIdAchievementRole(customId);
}
