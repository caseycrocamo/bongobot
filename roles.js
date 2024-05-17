import 'dotenv/config';
import { GetGuildRoles, InstallGuildRole, ModifyGuildRolePosition, ModifyMember } from "./utils.js";
import { PROFESSION_ROLES } from './roles/professionRoles.js';
import { getMemberRole, insertMemberRoleAssignment, updateMemberRoleAssignment } from './mongo.js';


export async function AddClassRoles(){
    let roleIds = [];
    PROFESSION_ROLES.map(async (role) => roleIds.push((await AddRole(role)).id));
    setTimeout(async () => ReorderRoles(roleIds), 2000);
}
async function AddRole(role){
    return await InstallGuildRole(process.env.GUILD_ID, role);
}
async function ReorderRoles(roleIds){
    const allRoles = await GetGuildRoles(process.env.GUILD_ID);
    const highestPosition = allRoles.reduce((accumulator, currentValue) => {
        if(currentValue.position > accumulator){
            accumulator = currentValue.position;
        }
        return accumulator;
    }, 0);
    const request = roleIds.map((id) => {return {id, position: highestPosition - 1}})
    ModifyGuildRolePosition(process.env.GUILD_ID, request);
}
export default async function setUsersActiveRole(member, guildId, roleName){
    console.log(`setting user ${member.user.id} active role to ${roleName} in guild ${guildId}`);
    const allRoles = await GetGuildRoles(guildId);
    const newRoleId = allRoles.find((role) => role.name.toLowerCase().replace(/\s+/g, '') === roleName.toLowerCase().replace(/\s+/g, '')).id;
    const currentMemberRole = (await getMemberRole(member.user.id, guildId))[0];
    let roles = [...member.roles];
    if(currentMemberRole){
        console.log(`found current user role with id: ${currentMemberRole.roleId}`);
        const index = roles.findIndex((role) => role === currentMemberRole.roleId);
        if(index != -1){
            if(roles[index] === newRoleId){
                console.log('existing role is the same as the new role, exiting early')
                return true;
            }
            roles[index] = newRoleId;
        }
        else{
            console.log('role was not found in users role list even though there was a db entry for the user');
            roles = [...roles, newRoleId];
        }
        await updateMemberRoleAssignment(member.user.id, guildId, newRoleId);
    }
    else{
        console.log(`assigning new role to user`);
        roles = [...roles, newRoleId];
        await insertMemberRoleAssignment(member.user.id, guildId, newRoleId);
    }
    console.log(roles);
    await ModifyMember(guildId, member.user.id, {roles});
    return true;
}