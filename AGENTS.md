# Agent Instructions and Command Conventions

## Adding a New Slash Command

When adding a new slash command to the bot, follow these conventions:

1. Define the command object in `commands/commands.js`
2. Add the command to the `ALL_COMMANDS` export
3. For public commands: define normally
4. For mod-only commands: declare `default_member_permissions` with the required permission bitfield string

### Mod-Only Commands

Mod-only commands must declare `default_member_permissions` to enforce permissions at the Discord level. This prevents users without the required permissions from seeing the command in their UI.

**Examples:**

```js
// Mod command that requires MANAGE_ROLES permission
const MANAGE_ROLES_PERMISSION = String(1 << 28); // "268435456"

export const GRANT_MEMBER_ACHIEVEMENT_COMMAND = {
    name: 'Grant Achievement',
    type: 2, // context menu command
    default_member_permissions: MANAGE_ROLES_PERMISSION
};
```

This approach has two layers of security:

1. **Primary enforcement (Discord level):** The `default_member_permissions` field prevents unauthorized users from seeing and invoking the command.
2. **Secondary enforcement (application level):** In-code permission checks (e.g., `memberCanManageRoles`) guard against edge cases (permissions changed after registration, direct API calls, etc.).

## Command Registration

After modifying `commands/commands.js`, always re-run the command registration to push updates to Discord:

```bash
# For guild-specific commands
npm run register-guild-commands

# For global commands
npm run register-global-commands
```

Command registration is idempotent — POSTing a command with the same name and type updates the existing registration.

## Permission Bitfields

Common Discord permission bits:

- `MANAGE_ROLES`: `1 << 28` = `268435456`
- `ADMINISTRATOR`: `1 << 3` = `8`
- `MANAGE_GUILD`: `1 << 5` = `32`

[Full permission reference](https://discord.com/developers/docs/topics/permissions)

## File Structure

- `commands/commands.js` - Command definitions
- `commands/installguild.js` - Guild command registration
- `commands/installglobal.js` - Global command registration
- `roles/profilehandler.js` - Command handlers and secondary authorization checks
