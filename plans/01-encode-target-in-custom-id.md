# Plan 1: Encode Target User ID in `custom_id` — Remove `MemberCommandState`

## Problem

When a mod uses "Grant Achievement" or "Set Profile", the target user's Discord ID is written to MongoDB (`MemberCommandState`), then read back and deleted on the follow-up component interaction. This adds 2–3 DB round-trips per command invocation for state that Discord itself can carry.

## Root Cause

The target user ID needed for the second interaction step is being persisted externally instead of being threaded through the interaction chain.

## Discord Docs Basis

The `custom_id` field on any interactive component is explicitly documented as:
> "a string of 1–100 characters and can be used flexibly to maintain state or pass through other important data."

A Discord user ID (18–19 digit snowflake) embedded in a `custom_id` like `set_user_achievement:123456789012345678` is ~39 characters — well within the 100-character limit.

## Proposed Changes

### `commands/commands.js` — No change required

### `roles/profilehandler.js` — `handleGrantAchievementCommand`

Replace `insertMemberCommandState(callingMember.user.id, target_id)` with encoding `target_id` into the dropdown's `custom_id`:

```js
// Before
await insertMemberCommandState(callingMember.user.id, target_id);
const components = [{
    type: 1,
    components: [{
        type: 3,
        custom_id: achievement_name_dropdown,
        ...
    }]
}];

// After — encode target_id into custom_id, no DB write needed
const components = [{
    type: 1,
    components: [{
        type: 3,
        custom_id: `${achievement_name_dropdown}:${target_id}`,
        ...
    }]
}];
```

### `roles/profilehandler.js` — `handleSetProfileCommand`

Same pattern — encode `target_id` into `profile_name_dropdown`'s `custom_id`:

```js
custom_id: `${profile_name_dropdown}:${target_id}`,
```

### `roles/profilehandler.js` — `handleAssignAchievement`

Remove all `getMemberCommandState` / `getTargetIdFromState` / `removeMemberCommandState` calls. Accept `target_id` as a direct parameter:

```js
// Before
export async function handleAssignAchievement(res, callingMember, guild_id, achievement_id) {
    const grantAchievementStates = await getMemberCommandState(callingMember.user.id);
    const targetUserId = await getTargetIdFromState(grantAchievementStates, callingMember.user.id);
    ...
}

// After
export async function handleAssignAchievement(res, callingMember, guild_id, achievement_id, targetUserId) {
    // targetUserId comes from the caller, parsed from custom_id
    ...
}
```

### `roles/profilehandler.js` — `handleSetProfile`

Same pattern — accept `targetId` as a direct parameter, remove DB state lookup:

```js
export async function handleSetProfile(res, callingMember, guild_id, role, targetId) {
    // targetId comes from the caller, parsed from custom_id
    ...
}
```

### `app.js` — `MESSAGE_COMPONENT` router

Parse `target_id` out of the `custom_id` before dispatching:

```js
// Before
case achievement_name_dropdown:
    return await handleAssignAchievement(res, member, guild_id, data.values[0]);

case profile_name_dropdown:
    return await handleSetProfile(res, member, guild_id, data.values[0]);

// After — split on ':' to extract encoded target user ID
case achievement_name_dropdown: {
    const [, targetUserId] = data.custom_id.split(':');
    return await handleAssignAchievement(res, member, guild_id, data.values[0], targetUserId);
}
case profile_name_dropdown: {
    const [, targetUserId] = data.custom_id.split(':');
    return await handleSetProfile(res, member, guild_id, data.values[0], targetUserId);
}
```

Note: The `switch` match needs to check the base prefix, not an exact match, since the `custom_id` now includes a suffix. Use `startsWith` or restructure the routing to extract the base key first:

```js
// Routing helper at top of MESSAGE_COMPONENT block
const [baseCustomId, encodedTargetId] = data.custom_id.split(':');

switch (baseCustomId) {
    case achievement_name_dropdown:
        return await handleAssignAchievement(res, member, guild_id, data.values[0], encodedTargetId);
    case profile_name_dropdown:
        return await handleSetProfile(res, member, guild_id, data.values[0], encodedTargetId);
    // ... other cases use baseCustomId too
}
```

### `mongo.js` — Remove `MemberCommandState` functions

Delete the following exports:
- `insertMemberCommandState`
- `getMemberCommandState`
- `removeMemberCommandState`

### `roles/profilehandler.js` — Remove `getTargetIdFromState`

Delete the private `getTargetIdFromState` function and all imports of the removed mongo functions.

## Files Changed

| File | Change |
|------|--------|
| `app.js` | Split `custom_id` on `:` before routing, use `baseCustomId` in switch |
| `roles/profilehandler.js` | Encode target in `custom_id`; accept `targetUserId` as param; remove DB state calls |
| `mongo.js` | Remove `insertMemberCommandState`, `getMemberCommandState`, `removeMemberCommandState` |

## AGENTS.md Updates

- Remove `MemberCommandState` from the MongoDB Collections table
- Add to "Adding a New MESSAGE_COMPONENT Interaction": target user IDs for multi-step mod commands must be encoded in `custom_id` using `:` as a delimiter (e.g., `base_custom_id:user_snowflake`)
- Update the routing note: split `data.custom_id` on `:` at the top of the `MESSAGE_COMPONENT` block and switch on `baseCustomId`
