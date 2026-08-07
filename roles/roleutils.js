export function getRoleIdByName(roles, name){
    const normalizedName = name?.toLowerCase().replace(/\s+/g, '');
    const matchedRole = roles.find((role) => role.name?.toLowerCase().replace(/\s+/g, '') === normalizedName);
    return matchedRole?.id;
}
export function getRoleNameById(roles, id){
    const matchedRole = roles.find((role) => role.id === id);
    return matchedRole?.name;
}
