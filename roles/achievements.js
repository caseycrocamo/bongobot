import { getAllMemberAchievements } from "../mongo.js";
import 'dotenv/config';
export async function getUsersAchievements(userId, guildId){
    const userAchievementDocuments = await getAllMemberAchievements(userId, guildId);
    return userAchievementDocuments?.map((userAchivement) => userAchivement.achievementId);
}