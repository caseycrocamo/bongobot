import { ACHIEVEMENT_ROLES } from "./achievementRoles.js";
import { CRAFTING_ROLES } from "./craftingRoles.js";
import { PROFESSION_ROLES } from "./professionRoles.js";

let CustomIdToRoleNameMap = {};
PROFESSION_ROLES.map((role) => {
    CustomIdToRoleNameMap[role.custom_id] = role.name;
});
ACHIEVEMENT_ROLES.map((role) => {
    CustomIdToRoleNameMap[role.custom_id] = role.name;
});
CRAFTING_ROLES.map((role) => {
    CustomIdToRoleNameMap[role.custom_id] = role.name;
});
export default CustomIdToRoleNameMap;
export function getRoleIdByName(roles, name){

    return roles.find((role) => role.name.toLowerCase().replace(/\s+/g, '') === name.toLowerCase().replace(/\s+/g, '')).id;
}