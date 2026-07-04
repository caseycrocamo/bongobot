# Plan 6: Fix `respondWithModal` Payload Shape

## Problem

The `respondWithModal` helper in `discordresponsehelper.js` sends an incorrect payload:

```js
export function respondWithModal(res, message, options = {}) {
    const {onlyShowToCreator, components} = options;
    let flags = generateFlags(onlyShowToCreator, components != null && components.length > 0);
    return res.send({
        type: InteractionResponseType.MODAL,
        data: {
            content: message,      // ❌ Not a valid field on modal responses
            components: components ?? [],
            flags: flags           // ❌ Not a valid field on modal responses
        },
    });
}
```

Discord will silently reject or mishandle this. A Modal interaction response requires `custom_id` and `title` — not `content` or `flags`.

## Root Cause

The `respondWithModal` function was written with the same signature as `respondWithComponentMessage`, but modal responses have a completely different data shape defined by the Discord API.

## Discord Docs Basis

Modal interaction response structure (callback type 9 — `MODAL`):

| Field | Type | Description |
|-------|------|-------------|
| `custom_id` | string | Developer-defined identifier for the modal, 1–100 characters |
| `title` | string | Title of the popup modal, max 45 characters |
| `components` | array | Between 1 and 5 components that make up the modal |

`flags` is not a valid field on a modal response. `content` is not a valid field on a modal response. Modals are not messages — they are popup forms.

Valid modal components are: `Label` (type 18, recommended), `Text Input` (type 4), `String Select` (type 3), `Radio Group` (type 21), `Checkbox Group` (type 22), `Checkbox` (type 23), `File Upload` (type 19). Legacy `Action Row` + `Text Input` is deprecated in favor of `Label`.

## Proposed Changes

### `discordresponsehelper.js` — `respondWithModal`

```js
// Before
export function respondWithModal(res, message, options = {}) {
    const {onlyShowToCreator, components} = options;
    let flags = generateFlags(onlyShowToCreator, components != null && components.length > 0);
    return res.send({
        type: InteractionResponseType.MODAL,
        data: {
            content: message,
            components: components ?? [],
            flags: flags
        },
    });
}

// After
export function respondWithModal(res, customId, title, components) {
    return res.send({
        type: InteractionResponseType.MODAL,
        data: {
            custom_id: customId,
            title,
            components
        },
    });
}
```

### Usage example

```js
// Displaying a modal in response to a command or component interaction
respondWithModal(res, 'bug_report_modal', 'Submit a Bug Report', [
    {
        type: 18, // Label
        label: 'Describe the bug',
        component: {
            type: 4, // Text Input
            custom_id: 'bug_description',
            style: 2, // Paragraph
            placeholder: 'What happened?',
            required: true
        }
    }
]);
```

## Files Changed

| File | Change |
|------|--------|
| `discordresponsehelper.js` | Rewrite `respondWithModal` with correct `customId`, `title`, `components` signature |

## AGENTS.md Updates

- Document the correct `respondWithModal(res, customId, title, components)` signature in the Key Files table entry for `discordresponsehelper.js`
- Add note: Modal responses (`type: 9`) require `custom_id` (1–100 chars) and `title` (max 45 chars). They do not accept `content` or `flags`. Components must be modal-compatible types (Label, Text Input, String Select, Radio Group, Checkbox Group, Checkbox, File Upload).
- Note that `Label` (type 18) is preferred over `Action Row` + `Text Input` in modals per current Discord docs.
