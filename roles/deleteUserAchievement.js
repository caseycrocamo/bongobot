import { deleteMemberAchievement } from "../mongo.js";

console.log(process.argv);
deleteMemberAchievement(process.argv[2]);