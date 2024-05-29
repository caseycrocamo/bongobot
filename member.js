export function memberCanManageRoles(member) {
    const {permissions} = member;
    const manageroles = 1 << 28;
    return (permissions & manageroles) == manageroles;
}