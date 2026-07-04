# Interaction Handler Guide

This guide documents how BongoBot routes Discord interactions and how to add new handlers for different interaction types.

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

1. Define the command name in Discord's developer portal
2. In `app.js`, add a `case` to the `APPLICATION_COMMAND` switch:
   ```js
   case 'my-command':
       console.log('matched on my-command.');
       return handleMyCommand(res, member, guild_id, options);
   ```
3. Implement the handler in an appropriate module (e.g., `profilehandler.js`)
4. Export it and import it at the top of `app.js`

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

## Adding a Modal Submit Handler

1. Define the modal's `custom_id` constant in `customids.js`:
   ```js
   export const my_modal_id = 'my_modal_id';
   ```
2. Use `respondWithModal(res, customId, title, components)` to display the modal from a command or component handler
   - Example: `respondWithModal(res, my_modal_id, 'Enter Details', [...components])`
   - See `discordresponsehelper.js` for the `respondWithModal` function signature
3. Import the constant at the top of `app.js`
4. Add a `case` to the `MODAL_SUBMIT` switch in `app.js`:
   ```js
   case my_modal_id:
       return handleMyModalSubmit(res, member, guild_id, components);
   ```
5. Implement the handler — modal submission data arrives in `components`:
   - `components` is an array of component interaction responses
   - Each component contains the submitted value(s) from the user
   - See Discord's [Modal Submit Object](https://discord.com/developers/docs/interactions/receiving-and-responding#modal-submit-object) documentation for the structure
6. Export the handler and import it at the top of `app.js`

## Response Pattern

All handlers **must** respond within **3 seconds** of receiving the interaction. Use one of these helpers from `discordresponsehelper.js`:

- `ackInteraction(res)` — Empty acknowledgement (no follow-up message needed)
- `respondWithDeferMessage(res, ...)` — Defer the response and send it later via webhook
- `respondWithModal(res, ...)` — Show a modal to the user
- Other response helpers for direct messages, embeds, components, etc.

If no response is sent within 3 seconds, Discord shows a "This interaction failed" error to the user.

## Custom ID Centralization

All component and modal `custom_id` values **must** be defined as constants in `customids.js` and imported at the top of `app.js`. This prevents:
- Typos and mismatches between the request and handler
- Accidental duplication of IDs across handlers
- Hard-coded strings scattered throughout the codebase
