# Plan 3: Remove Incorrect `IS_COMPONENTS_V2` Flag from Legacy Component Messages

## Problem

`generateFlags` in `discordresponsehelper.js` sets `1 << 15` (= 32768 = `IS_COMPONENTS_V2`) whenever `components` is non-empty. Every message that includes buttons or select menus — the vast majority of bot responses — has this flag set.

Per the Discord documentation, `IS_COMPONENTS_V2` **disables the `content` field entirely**. All message text must instead be delivered through `Text Display` (type 10) components. The current code sends both `content` (the human-readable message string) and `components` (Action Row with buttons/selects) with this flag set, which is invalid.

## Root Cause

The flag was added to signal "this message has components" but `IS_COMPONENTS_V2` is not a generic "has components" flag — it is the opt-in flag for Discord's new v2 component layout system, which is incompatible with the `content` field.

## Discord Docs Basis

From the component reference:
> "To use these components, you need to send the message flag `1 << 15` (IS_COMPONENTS_V2)... The `content` and `embeds` fields will no longer work but you'll be able to use Text Display and Container as replacements."

From the interaction callback data structure:
> Flags: "only `SUPPRESS_EMBEDS`, `EPHEMERAL`, `IS_COMPONENTS_V2`, `IS_VOICE_MESSAGE`, and `SUPPRESS_NOTIFICATIONS` can be set"

Legacy Action Row + Button/Select messages work correctly with no special component flag. The only flag needed for bot responses is `EPHEMERAL` (`1 << 6`) when the message should only be visible to the invoking user.

## Proposed Changes

### `discordresponsehelper.js` — `generateFlags`

```js
// Before
export function generateFlags(onlyShowToCreator, isComponentMessage) {
    let flags = null;
    if (onlyShowToCreator === true) {
        flags = flags | (1 << 6);
    }
    if (isComponentMessage === true) {
        flags = flags | (1 << 15);  // REMOVE THIS — incorrect usage
    }
    return flags;
}

// After
export function generateFlags(onlyShowToCreator) {
    if (onlyShowToCreator === true) {
        return (1 << 6); // EPHEMERAL
    }
    return null;
}
```

### `discordresponsehelper.js` — All callers of `generateFlags`

Remove the second argument (`isComponentMessage`) from all calls to `generateFlags`. The parameter and its logic are deleted entirely.

Affected functions in `discordresponsehelper.js`:
- `respondWithModal` — remove `generateFlags(onlyShowToCreator, ...)` second arg
- `respondWithComponentMessage` — same
- `respondWithUpdateMessage` — same
- `updateChannelMessageAfterDefer` — same

### `discordresponsehelper.js` — Function signatures

Remove the `isComponentMessage` destructure from `options` in all response helpers:

```js
// Before
const {onlyShowToCreator, components} = options;
let flags = generateFlags(onlyShowToCreator, components != null && components.length > 0);

// After
const {onlyShowToCreator, components} = options;
let flags = generateFlags(onlyShowToCreator);
```

## Files Changed

| File | Change |
|------|--------|
| `discordresponsehelper.js` | Remove `isComponentMessage` logic from `generateFlags`; remove second arg from all callers |

## Future Use of `IS_COMPONENTS_V2`

If the bot is ever migrated to the v2 component layout system (for richer message formatting using Sections, Containers, Media Gallery, etc.), `IS_COMPONENTS_V2` should be set on those specific messages only. That migration requires:

1. Removing the `content` field from the message
2. Replacing all `content` strings with `Text Display` (type 10) components
3. Setting `flags: 1 << 15` on those specific messages

This is a separate, opt-in migration — not a blanket flag on all messages.

## AGENTS.md Updates

- Add to the Conventions section: *"Do not set `IS_COMPONENTS_V2` (`1 << 15`) on messages that also send `content`. This flag disables the `content` field. Legacy Action Row interactions (buttons, selects) require no special flags."*
- Add a note to `discordresponsehelper.js` usage: `generateFlags(onlyShowToCreator)` — single argument only; `EPHEMERAL` is the only flag set by the helper.
