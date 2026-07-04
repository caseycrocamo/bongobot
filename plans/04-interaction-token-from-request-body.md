# Plan 4: Extract Interaction Token Directly from `req.body`

## Problem

Multiple handlers extract the interaction token by reading from the response object after calling a defer helper:

```js
const response = respondWithDeferMessage(res);
const interactionToken = response.req.body.token;
```

`res.send()` returns `res` (the Express `Response` object). `res.req` is the original `Request` — this works because Express attaches `req` to `res` internally. This is undocumented Express behavior that relies on internal coupling between request and response objects, not a stable API contract.

## Root Cause

The `token` is available on `req.body` the moment the HTTP request arrives. Handlers that need to defer and then follow up should read it from the request, not back out of the response.

## Discord Docs Basis

The Interaction object structure shows `token` as a top-level field:
> "`token` — Continuation token for responding to the interaction"

The token is valid for **15 minutes** and must be used (via the webhooks endpoint) to send follow-up messages after a deferred response. It lives in `req.body.token` — the same place as `type`, `data`, `member`, and `guild_id` that are already destructured in `app.js`.

## Proposed Changes

### `app.js` — Destructure `token` at the top of the interactions handler

```js
// Before
const { type, data, member, guild_id } = req.body;

// After
const { type, data, member, guild_id, token } = req.body;
```

Pass `token` into handlers that use the defer pattern:

```js
case 'achievements':
    return await handleAchievementsCommand(res, member.user.id, guild_id, options, token);

// In MESSAGE_COMPONENT block:
case achievement_name_dropdown:
    return await handleAssignAchievement(res, member, guild_id, data.values[0], targetUserId, token);

case profile_name_dropdown:
    return await handleSetProfile(res, member, guild_id, data.values[0], targetUserId, token);
```

### `roles/achievementHandler.js` — `handleAchievementsCommand`

Accept `interactionToken` as a parameter; do not read it from the response:

```js
// Before
export async function handleAchievementsCommand(res, userId, guildId, commandOptions) {
    ...
    response = await respondWithDeferMessage(res);
    interactionToken = response.req.body.token;
    return await handleViewAchievements(interactionToken, userId, guildId);
}

// After
export async function handleAchievementsCommand(res, userId, guildId, commandOptions, interactionToken) {
    ...
    respondWithDeferMessage(res);
    return await handleViewAchievements(interactionToken, userId, guildId);
}
```

Apply the same pattern to the `'achieve'` subcommand branch.

### `roles/profilehandler.js` — `handleAssignAchievement` and `handleSetProfile`

Accept `interactionToken` as a parameter:

```js
// Before
export async function handleAssignAchievement(res, callingMember, guild_id, achievement_id) {
    const response = await respondWithUpdateMessage(res, 'Attempting to assign achievement. Please hold...');
    const interactionToken = response.req.body.token;
    ...
}

// After
export async function handleAssignAchievement(res, callingMember, guild_id, achievement_id, targetUserId, interactionToken) {
    respondWithUpdateMessage(res, 'Attempting to assign achievement. Please hold...');
    ...
}
```

Same for `handleSetProfile` and `handleProfileUpdate`.

### `discordresponsehelper.js` — No change required

The response helpers remain as-is. The return value of `res.send()` is no longer used to extract the token.

## Files Changed

| File | Change |
|------|--------|
| `app.js` | Destructure `token` from `req.body`; pass to handlers |
| `roles/achievementHandler.js` | Accept `interactionToken` param; stop reading from response |
| `roles/profilehandler.js` | Accept `interactionToken` param in defer-pattern handlers |

## AGENTS.md Updates

- Update the Deferred Response Pattern example to show `token` destructured from `req.body` before the defer call:

```js
// Correct pattern
const { token: interactionToken } = req.body; // available from the start
respondWithDeferMessage(res);
await doWork();
await updateChannelMessageAfterDefer(interactionToken, 'Result');
```

- Remove the incorrect example that reads `response.req.body.token`.
