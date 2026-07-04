# Plan 2: Enforce Mod Command Permissions at Discord Level via `default_member_permissions`

## Problem

"Grant Achievement" and "Set Profile" are context menu commands (type 2 — USER commands) that check `memberCanManageRoles(member)` in application code after Discord has already delivered the interaction. Users without Manage Roles still see these commands in the right-click menu and can invoke them, receiving an error message response. The permission check is happening in the wrong place.

## Root Cause

The command definitions in `commands/commands.js` do not declare `default_member_permissions`, so Discord exposes them to all guild members by default.

## Discord Docs Basis

The `default_member_permissions` field on an application command object:
> "Set of permissions represented as a bit set. Setting it to `'0'` will prohibit anyone in a guild from using the command unless a specific overwrite is configured or the user has admin permissions."

When set, Discord enforces this server-side — the command does not appear in the UI for unauthorized users and the interaction is rejected before reaching the bot. This is the documented idiomatic approach for access-restricted commands.

`MANAGE_ROLES` permission bit: `1 << 28` = `268435456`

## Proposed Changes

### `commands/commands.js`

```js
// Add this constant at the top
const MANAGE_ROLES_PERMISSION = String(1 << 28); // "268435456"

export const GRANT_MEMBER_ACHIEVEMENT_COMMAND = {
    name: 'Grant Achievement',
    type: 2,
    default_member_permissions: MANAGE_ROLES_PERMISSION
};

export const SET_MEMBER_PROFILE_COMMAND = {
    name: 'Set Profile',
    type: 2,
    default_member_permissions: MANAGE_ROLES_PERMISSION
};
```

### `roles/profilehandler.js` — Retain `memberCanManageRoles` as a secondary check

The existing in-code check in `handleGrantAchievementCommand` and `handleSetProfileCommand` remains as a defensive secondary layer but is no longer the primary enforcement mechanism. Add a comment making this explicit:

```js
// Secondary authorization check — primary enforcement is via default_member_permissions
// on the command definition. This guards against edge cases (e.g., permissions changed
// after command registration, or direct API calls bypassing the Discord client).
const authorized = await memberCanManageRoles(callingMember);
```

### After code changes: Re-register commands

The updated command definitions must be pushed to Discord:

```bash
npm run register-guild-commands
```

Or for global commands:

```bash
npm run register-global-commands
```

Command registration is idempotent — POSTing a command with the same name updates the existing registration.

## Files Changed

| File | Change |
|------|--------|
| `commands/commands.js` | Add `default_member_permissions: "268435456"` to `GRANT_MEMBER_ACHIEVEMENT_COMMAND` and `SET_MEMBER_PROFILE_COMMAND` |
| `roles/profilehandler.js` | Add clarifying comment on the secondary role of `memberCanManageRoles` |

## AGENTS.md Updates

- Add to the "Adding a New Slash Command" and command conventions sections: mod-only commands must declare `default_member_permissions` with the required permission bitfield string. The in-code `member.js` check is a secondary defensive layer.
- Add a note: after modifying `commands/commands.js`, always re-run `npm run register-guild-commands` (or `register-global-commands`) to push the updated definitions to Discord.
