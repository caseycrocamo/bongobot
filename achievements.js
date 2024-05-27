import { getAllMemberAchievements } from "./mongo.js";

export async function getUsersAchievements(userId, guildId){
    const userAchievementDocuments = await getAllMemberAchievements(userId, guildId);
    return userAchievementDocuments?.map((userAchivement) => userAchivement.achievementId);
}