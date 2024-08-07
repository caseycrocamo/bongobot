import 'dotenv/config';
import { GetGuildRoles, InstallGuildRole, ModifyGuildRolePosition, ModifyMember } from "../discordclient.js";
import { getMemberRole, insertMemberRoleAssignment, removeMemberRole, updateMemberRoleAssignment } from '../mongo.js';
import { CustomIdToRoleNameMap, getRoleIdByName } from './roleutils.js';


export async function AddGuildRoles(roleList){
    const currentGuildRoles = await GetGuildRoles(process.env.GUILD_ID);
    const newRoles = roleList.filter((role) => currentGuildRoles.findIndex((currentRole) => currentRole.name == role.name) === -1);
    const newRoleNames = newRoles.map((role) => role.name);
    console.log('adding new roles to guild id:', process.env.GUILD_ID, newRoleNames);
    let roleIds = [];
    newRoles.map(async (role) => roleIds.push((await AddRole(role)).id));
    setTimeout(async () => ReorderRoles(roleIds, currentGuildRoles), 2000);
}
async function AddRole(role){
    return await InstallGuildRole(process.env.GUILD_ID, role);
}
async function ReorderRoles(roleIds, currentRoles){
    const highestPosition = currentRoles.reduce((accumulator, currentValue) => {
        if(currentValue.position > accumulator){
            accumulator = currentValue.position;
        }
        return accumulator;
    }, 0);
    const request = roleIds.map((id) => {return {id, position: highestPosition - 1}})
    ModifyGuildRolePosition(process.env.GUILD_ID, request);
}

export async function removeUsersCurrentRole(member, guildId){
    let roles = [...member.roles];
    const currentMemberRole = (await getMemberRole(member.user.id, guildId))[0];
    if(!currentMemberRole){
        console.log('current user role not found in DB when remove role was called. Exiting early. Member name: ', member.user.name);
        return false;
    }
    console.log(`found current user role with id: ${currentMemberRole.roleId}`);
    const index = roles.findIndex((role) => role === currentMemberRole.roleId);
    if(index === -1){
        console.log('current user role from DB not found in users role list when remove role was called. Exiting early. Member name: ', member.user.name);
        return false;
    }
    roles.splice(index, 1);
    await removeMemberRole(member.user.id, guildId, currentMemberRole);
    await ModifyMember(guildId, member.user.id, {roles});
    return true;
}

export async function setUsersActiveRoleFromCustomId(member, guildId, customId){
    let roleName = CustomIdToRoleNameMap[customId];
    console.log(`setting user ${member.user.id} active role to "${roleName}" in guild ${guildId}`);
    const allRoles = await GetGuildRoles(guildId);
    const newRoleId = getRoleIdByName(allRoles, roleName);
    return await setUsersActiveRole(member, guildId, newRoleId);
}
export async function setUsersActiveRole(member, guildId, roleId){
    const currentMemberRole = (await getMemberRole(member.user.id, guildId))[0];
    let roles = [...member.roles];
    if(currentMemberRole){
        console.log(`found current user role with id: ${currentMemberRole.roleId}`);
        const index = roles.findIndex((role) => role === currentMemberRole.roleId);
        if(index != -1){
            if(roles[index] === roleId){
                console.log('existing role is the same as the new role, exiting early')
                return true;
            }
            roles[index] = roleId;
        }
        else{
            console.log('role was not found in users role list even though there was a db entry for the user');
            roles = [...roles, roleId];
        }
        await updateMemberRoleAssignment(member.user.id, guildId, roleId);
    }
    else{
        console.log(`assigning new role to user`);
        roles = [...roles, roleId];
        await insertMemberRoleAssignment(member.user.id, guildId, roleId);
    }
    await ModifyMember(guildId, member.user.id, {roles});
    return true;
}
export function isRoleIdManagedRole(roleId){

}