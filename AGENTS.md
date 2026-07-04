# Agent Instructions and Conventions

This guide documents how BongoBot routes Discord interactions and how to add new commands, handlers, and components.

## Interaction Flow

BongoBot handles five types of Discord interactions in `app.js`:

| Type | Value | Status | Handler |
|------|-------|--------|---------|
| `PING` | 1 | ✅ | `ackInteraction()` — responds to Discord heartbeat pings |
| `APPLICATION_COMMAND` | 2 | ✅ | Slash command router — routes by command `name` |
| `MESSAGE_COMPONENT` | 3 | ✅ | Component router — routes by component `custom_id` |
| `APPLICATION_COMMAND_AUTOCOMPLETE` | 4 | — | Not currently implemented (not needed) |
| `MODAL_SUBMIT` | 5 | ✅ | Modal submit router — routes by modal `custom_id` |

## Adding a Slash Command Handler

1. Define the command object in `commands/commands.js` and add it to the `ALL_COMMANDS` export
2. For public commands: define normally
3. For mod-only commands: declare `default_member_permissions` with the required permission bitfield string (see Mod-Only Commands below)
4. In `app.js`, add a `case` to the `APPLICATION_COMMAND` switch:
   ```js
   case 'my-command':
       console.log('matched on my-command.');
       return handleMyCommand(res, member, guild_id, options);
   ```
5. Implement the handler in an appropriate module (e.g., `profilehandler.js`)
6. Export it and import it at the top of `app.js`
7. After modifying `commands/commands.js`, re-run command registration (see Command Registration below)

### Mod-Only Commands

Mod-only commands must declare `default_member_permissions` to enforce permissions at the Discord level. This prevents users without the required permissions from seeing the command in their UI.

**Example:**

```js
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

## Adding a Message Component Handler

1. Define the component's `custom_id` constant in `customids.js`:
   ```js
   export const my_component_id = 'my_component_id';
   ```
2. Use the component in a response (button, select menu, etc.) with that `custom_id`
3. Import the constant at the top of `app.js`
4. Add a `case` to the `MESSAGE_COMPONENT` switch:
   ```js
   case my_component_id:
       return await handleMyComponent(res, member, guild_id, data.values[0]);
   ```
5. Implement the handler — component interaction data arrives in `data`:
   - For select menus: `data.values` is an array of selected option values
   - For buttons: `data.custom_id` is the button's custom_id (useful for parameterized buttons)
6. Export the handler and import it at the top of `app.js`

### Multi-Step Mod Commands and `custom_id` Encoding

For mod commands that require a target user ID to be carried across interaction steps (e.g., Grant Achievement, Set Profile), encode the target user's Discord snowflake into the `custom_id` using `:` as a delimiter:

```js
// When building the dropdown for a mod command:
custom_id: `${achievement_name_dropdown}:${target_id}`

// In the MESSAGE_COMPONENT router, split before switching:
const [baseCustomId, encodedTargetId] = custom_id.split(':');
switch(baseCustomId) {
    case achievement_name_dropdown:
        return await handleAssignAchievement(res, member, guild_id, data.values[0], encodedTargetId, token);
}
```

Do **not** write this state to MongoDB (`MemberCommandState` has been removed). The `custom_id` field supports up to 100 characters — a base ID plus an 18–19 digit snowflake is well within that limit.

## Adding a Modal Submit Handler

1. Define the modal's `custom_id` constant in `customids.js`:
   ```js
   export const my_modal_id = 'my_modal_id';
   ```
2. Use `respondWithModal(res, customId, title, components)` to display the modal from a command or component handler
3. Import the constant at the top of `app.js`
4. Add a `case` to the `MODAL_SUBMIT` switch in `app.js`:
   ```js
   case my_modal_id:
       return handleMyModalSubmit(res, member, guild_id, components);
   ```
5. Implement the handler — modal submission data arrives in `components` as an array of component interaction responses
6. Export the handler and import it at the top of `app.js`

Note: Modal responses (`type: 9`) require `custom_id` (1–100 chars) and `title` (max 45 chars). They do **not** accept `content` or `flags`. Components must be modal-compatible types (Label type 18, Text Input type 4, String Select type 3, etc.). `Label` (type 18) is preferred over legacy `Action Row` + `Text Input`.

## Response Pattern

All handlers **must** respond within **3 seconds** of receiving the interaction. Use one of these helpers from `discordresponsehelper.js`:

- `ackInteraction(res)` — Empty acknowledgement (no follow-up message needed)
- `respondWithDeferMessage(res, ...)` — Defer the response and send it later via webhook
- `respondWithModal(res, customId, title, components)` — Show a modal to the user
- `respondWithComponentMessage(res, message, options)` — Send a message with buttons/selects
- `respondWithUpdateMessage(res, message, options)` — Update the existing message in-place

If no response is sent within 3 seconds, Discord shows a "This interaction failed" error to the user.

### Deferred Response Pattern

For long-running operations, defer immediately and follow up via webhook:

```js
// Correct pattern — token is available from req.body from the start
const { type, data, member, guild_id, token } = req.body;
// ...pass token into the handler...

// In the handler:
respondWithDeferMessage(res);
await doWork();
await updateChannelMessageAfterDefer(token, 'Result message');
```

Do **not** extract the token from the response object (`response.req.body.token`). Read it from `req.body` before calling any defer helper.

## Flags

`generateFlags(onlyShowToCreator)` accepts a single boolean argument. When `true`, it sets the `EPHEMERAL` flag (`1 << 6`) to make the response visible only to the invoking user.

Do **not** set `IS_COMPONENTS_V2` (`1 << 15`) on messages that also send `content`. This flag disables the `content` field. Legacy Action Row interactions (buttons, selects) require no special flags.

## Custom ID Centralization

All component and modal `custom_id` values **must** be defined as constants in `customids.js` and imported at the top of `app.js`. This prevents typos, mismatches, and hard-coded strings scattered throughout the codebase.

## Command Registration

After modifying `commands/commands.js`, always re-run command registration to push updates to Discord:

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

- `commands/commands.js` — Command definitions and `default_member_permissions`
- `commands/installguild.js` — Guild command registration
- `commands/installglobal.js` — Global command registration
- `app.js` — Interaction router (PING, APPLICATION_COMMAND, MESSAGE_COMPONENT, MODAL_SUBMIT)
- `roles/profilehandler.js` — Command handlers and secondary authorization checks
- `discordresponsehelper.js` — Response helpers (`respondWithModal`, `respondWithComponentMessage`, `generateFlags`, etc.)
- `customids.js` — All `custom_id` constants for components and modals
