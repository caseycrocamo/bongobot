# Discord Response Helper API

## Key Files

| File | Description |
|------|-------------|
| `discordresponsehelper.js` | Helper functions for Discord interaction responses |

## Response Functions

### `respondWithModal(res, customId, title, components)`

Sends a modal (popup form) interaction response.

**Parameters:**
- `res` - Express response object
- `customId` (string) - Developer-defined identifier for the modal, 1–100 characters
- `title` (string) - Title of the popup modal, max 45 characters
- `components` (array) - Between 1 and 5 components that make up the modal

**Modal Requirements:**
- Modal responses (`type: 9`) require `custom_id` (1–100 chars) and `title` (max 45 chars)
- They do **not** accept `content` or `flags` fields
- Components must be modal-compatible types: Label (type 18), Text Input (type 4), String Select (type 3), Radio Group (type 21), Checkbox Group (type 22), Checkbox (type 23), File Upload (type 19)
- `Label` (type 18) is preferred over `Action Row` + `Text Input` in modals per current Discord docs

**Example Usage:**

```js
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

### Other Response Functions

- `ackInteraction(res)` - Sends a PONG interaction response (acknowledgement)
- `respondWithComponentMessage(res, message, options)` - Sends a channel message with components
- `respondWithUpdateMessage(res, message, options)` - Updates the original interaction message
- `respondWithDeferMessage(res, onlyShowToCreator)` - Defers the interaction response
- `respondWithDeferUpdate(res)` - Defers a message component interaction
- `respondWithCommandNotImplemented(res)` - Sends a "not implemented" response
