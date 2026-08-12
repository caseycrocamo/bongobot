import 'dotenv/config';
import { GetGuildRoles, InstallGuildRole, ModifyGuildRolePosition, ModifyMember } from "../discordclient.js";
import { getAllRolePositionAnchors, getMemberRole, insertMemberRoleAssignment, removeMemberRole, updateMemberRoleAssignment } from '../mongo.js';
import { getRoleIdByName } from './roleutils.js';
import { getRoleNameByCustomId } from './effectiveCatalog.js';

// Pure: compute the target position for a new role. If any anchor roleId is
// present in currentRoles, target the lowest-positioned anchor's slot (which
// lands the new role directly below it); otherwise fall back to the current
// default (just below the highest role).
// Returns { position, source } where source is 'anchor' or 'default'.
export function computeTargetPositionBelowAnchors(currentRoles, anchorRoleIds){
    const roles = Array.isArray(currentRoles) ? currentRoles : [];
    const highestPosition = roles.reduce((acc, r) => (r.position > acc ? r.position : acc), 0);
    const anchorIds = new Set(anchorRoleIds || []);
    const anchorPositions = roles
        .filter((r) => anchorIds.has(r.id))
        .map((r) => r.position);
    if (anchorPositions.length > 0) {
        const minAnchorPosition = Math.min(...anchorPositions);
        return { position: Math.max(minAnchorPosition, 1), source: 'anchor' };
    }
    return { position: Math.max(highestPosition - 1, 1), source: 'default' };
}

// Resolves anchors from mongo and computes the target position for currentRoles.
async function resolveTargetPosition(currentRoles){
    const anchors = await getAllRolePositionAnchors(process.env.GUILD_ID);
    const anchorRoleIds = (anchors || []).map((a) => a.roleId);
    return computeTargetPositionBelowAnchors(currentRoles, anchorRoleIds);
}


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
    const { position, source } = await resolveTargetPosition(currentRoles);
    console.log(`Reordering ${roleIds.length} new role(s) to position ${position} (${source})`);
    const request = roleIds.map((id) => {return {id, position}})
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
    const roleName = await getRoleNameByCustomId(customId);
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

export async function createAndPositionRole(role){
    const created = await InstallGuildRole(process.env.GUILD_ID, role);
    if(!created || !created.id){
        return created; // falsy / missing id => caller treats as failure
    }
    const currentRoles = await GetGuildRoles(process.env.GUILD_ID);
    const target = await resolveTargetPosition(currentRoles);
    console.log(`Positioning new role ${created.id} at position ${target.position} (${target.source})`);
    const result = await ModifyGuildRolePosition(process.env.GUILD_ID, [{ id: created.id, position: target.position }]);
    // Best-effort: a successful PATCH returns the full role array. If it failed
    // and we were targeting below anchors, retry once at the default position.
    if (!Array.isArray(result) && target.source === 'anchor') {
        const fallback = computeTargetPositionBelowAnchors(currentRoles, []);
        console.warn(`Anchor placement failed for role ${created.id}; falling back to default position ${fallback.position}`);
        await ModifyGuildRolePosition(process.env.GUILD_ID, [{ id: created.id, position: fallback.position }]);
    }
    return created;
}