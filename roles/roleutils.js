import { ACHIEVEMENT_ROLES } from "./achievementRoles.js";
import { PROFESSION_ROLES } from "./professionRoles.js";

let CustomIdToRoleNameMap = {};
PROFESSION_ROLES.map((role) => {
    CustomIdToRoleNameMap[role.custom_id] = role.name;
});
ACHIEVEMENT_ROLES.map((role) => {
    CustomIdToRoleNameMap[role.custom_id] = role.name;
});
export default CustomIdToRoleNameMap;