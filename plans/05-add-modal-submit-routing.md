# Plan 5: Add `MODAL_SUBMIT` Interaction Routing to `app.js`

## Problem

`app.js` routes three of the five interaction types:
- `PING` (1) ✅
- `APPLICATION_COMMAND` (2) ✅
- `MESSAGE_COMPONENT` (3) ✅

But has no handler for:
- `APPLICATION_COMMAND_AUTOCOMPLETE` (4) — not currently needed
- `MODAL_SUBMIT` (5) ❌ — missing

The `respondWithModal` helper already exists in `discordresponsehelper.js`, so modal responses are buildable in the codebase. If any handler ever calls `respondWithModal`, the modal submission will arrive as a `MODAL_SUBMIT` interaction that falls through all routing logic silently — Discord will show a "This interaction failed" error to the user after 3 seconds.

## Root Cause

`MODAL_SUBMIT` was never added to the interaction router when `respondWithModal` was written.

## Discord Docs Basis

Interaction types from the spec:

| Name | Value |
|------|-------|
| PING | 1 |
| APPLICATION_COMMAND | 2 |
| MESSAGE_COMPONENT | 3 |
| APPLICATION_COMMAND_AUTOCOMPLETE | 4 |
| MODAL_SUBMIT | 5 |

Modal submit data structure:
- `custom_id` — the identifier set when the modal was created
- `components` — array of component interaction responses containing user-submitted values

Modals must be responded to within 3 seconds (same rule as all interactions).

## Proposed Changes

### `app.js` — Add `MODAL_SUBMIT` block

Import `InteractionType` already includes all types via `discord-interactions`. Add the routing block after the `MESSAGE_COMPONENT` block:

```js
if (type === InteractionType.MODAL_SUBMIT) {
    const { custom_id, components } = data;
    console.log(`Received MODAL_SUBMIT for custom_id: ${custom_id}`);
    // Route by custom_id as modal handlers are added
    // Default: acknowledge the interaction to prevent Discord timeout
    return ackInteraction(res);
}
```

When modal handlers are implemented, this block should follow the same switch-on-`custom_id` pattern as `MESSAGE_COMPONENT`:

```js
if (type === InteractionType.MODAL_SUBMIT) {
    const { custom_id, components } = data;
    switch (custom_id) {
        case 'my_modal_id':
            return await handleMyModalSubmit(res, member, guild_id, components, token);
        default:
            console.warn(`Unhandled MODAL_SUBMIT: ${custom_id}`);
            return ackInteraction(res);
    }
}
```

## Files Changed

| File | Change |
|------|--------|
| `app.js` | Add `MODAL_SUBMIT` (type 5) routing block after `MESSAGE_COMPONENT` |

## AGENTS.md Updates

- Add `MODAL_SUBMIT` (5) to the Interaction Flow table
- Add "Adding a Modal Submit Handler" section:
  1. Define the modal's `custom_id` constant in `customids.js`
  2. Use `respondWithModal(res, customId, title, components)` to display the modal from a command or component handler
  3. Add a `case` to the `MODAL_SUBMIT` switch in `app.js`
  4. Implement the handler — modal submission data arrives in `data.components` as an array of component interaction responses
