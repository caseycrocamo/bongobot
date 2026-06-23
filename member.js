export function memberCanManageRoles(member) {
    const permissionsRaw = member?.permissions;
    if(permissionsRaw === undefined || permissionsRaw === null){
        return false;
    }

    const permissions = BigInt(permissionsRaw);
    const manageRoles = 1n << 28n;
    const administrator = 1n << 3n;
    return (permissions & manageRoles) === manageRoles || (permissions & administrator) === administrator;
}