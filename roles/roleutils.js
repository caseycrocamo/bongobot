import { ACHIEVEMENT_ROLES } from "./achievementRoles.js";
import { CRAFTING_ROLES } from "./craftingRoles.js";
import { PROFESSION_ROLES } from "./professionRoles.js";

let CustomIdToRoleNameMap = {};
let RoleNameToCustomIdMap = {};
PROFESSION_ROLES.map((role) => {
    CustomIdToRoleNameMap[role.custom_id] = role.name;
});
ACHIEVEMENT_ROLES.map((role) => {
    CustomIdToRoleNameMap[role.custom_id] = role.name;
});
CRAFTING_ROLES.map((role) => {
    CustomIdToRoleNameMap[role.custom_id] = role.name;
});
PROFESSION_ROLES.map((role) => {
    RoleNameToCustomIdMap[role.name] = role.custom_id;
});
ACHIEVEMENT_ROLES.map((role) => {
    RoleNameToCustomIdMap[role.name] = role.custom_id;
});
CRAFTING_ROLES.map((role) => {
    RoleNameToCustomIdMap[role.name] = role.custom_id;
});
export function getRoleIdByName(roles, name){
    const normalizedName = name?.toLowerCase().replace(/\s+/g, '');
    const matchedRole = roles.find((role) => role.name?.toLowerCase().replace(/\s+/g, '') === normalizedName);
    return matchedRole?.id;
}
export function getRoleNameById(roles, id){
    const matchedRole = roles.find((role) => role.id === id);
    return matchedRole?.name;
}
export {CustomIdToRoleNameMap, RoleNameToCustomIdMap};