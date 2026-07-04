# Plan Completion Report

## 1. Blind Spots Analysis

### Cross-Plan Signature Conflicts (`app.js`, `roles/profilehandler.js`)

Plans 1, 4, and 5 all modify `app.js`. Plans 1, 2, and 4 all modify `roles/profilehandler.js`. An agent executing any one of these in isolation will produce a signature that conflicts with the others:

- **Plan 1** adds `targetUserId` as parameter 5 of `handleAssignAchievement` and `handleSetProfile`.
- **Plan 4** adds `interactionToken` as a parameter to the same functions, and to `handleAchievementsCommand`.
- An agent implementing Plan 1 without Plan 4 context produces `(res, callingMember, guild_id, achievement_id, targetUserId)`. An agent then implementing Plan 4 must know to append `interactionToken` at position 6 — not position 5. Plan 4 shows the combined signature, but an isolated agent cannot know Plan 1 has already been applied.

### Security Regression: Authorization Check Not Propagated (Plans 1 + 2)

`handleGrantAchievementCommand` and `handleSetProfileCommand` call `memberCanManageRoles` before proceeding. `handleAssignAchievement` and `handleSetProfile` do not — they rely on the DB state lookup (`getMemberCommandState`) as an implicit proof that the mod flow was followed.

Plan 1 removes `MemberCommandState` entirely and passes `targetUserId` via `custom_id`. After this change, a `MESSAGE_COMPONENT` interaction with a crafted `custom_id` like `set_user_achievement:anyUserId` would invoke `handleAssignAchievement` with an arbitrary target — bypassing the authorization check in `handleGrantAchievementCommand` entirely. Plan 2's `default_member_permissions` enforces this at the Discord UI level but not against direct API calls.

Neither Plan 1 nor Plan 2 adds a `memberCanManageRoles` check inside `handleAssignAchievement` or `handleSetProfile`. No agent working on a single plan would see this gap.

### `discordresponsehelper.js` Touched by Two Plans (Plans 3 + 6)

Plan 3 removes the `isComponentMessage` parameter from `generateFlags` and all its callers. Plan 6 rewrites `respondWithModal` in the same file. An agent implementing Plan 6 after Plan 3 would need to know `generateFlags` now takes only one argument — but Plan 6 shows the old `generateFlags(onlyShowToCreator, ...)` call in its "Before" example. An agent implementing Plan 6 in isolation would leave the old two-argument call untouched.

### `app.js` `default` Case Ambiguity After Plan 1's Split

Plan 1 introduces `const [baseCustomId, encodedTargetId] = data.custom_id.split(':')` and uses `baseCustomId` in the switch. The comment `// ... other cases use baseCustomId too` is ambiguous about the `default` case, which currently passes `data.custom_id` directly to `handleProfileUpdate` → `setUsersActiveRoleFromCustomId`. The plan does not specify whether the `default` case should use `baseCustomId` or `data.custom_id`. An agent that substitutes `baseCustomId` everywhere breaks nothing for current custom IDs (none contain `:`), but the intent is undocumented and fragile.

### AGENTS.md Does Not Exist

All six plans include an "AGENTS.md Updates" section. No `AGENTS.md` file exists in the repository. No plan specifies creating it from scratch. Six independently operating agents would each try to update a file that doesn't exist, or each create it independently with different structure and scope.

---

## 2. Completion Status

| Plan | Title | Status | Notes |
|------|-------|--------|-------|
| 01 | Encode Target in `custom_id` / Remove `MemberCommandState` | **Not Started** | No completion summary. No code changes. `MemberCommandState` still used; routing unchanged. |
| 02 | `default_member_permissions` on Mod Commands | **Not Started** | No completion summary. `GRANT_MEMBER_ACHIEVEMENT_COMMAND` and `SET_MEMBER_PROFILE_COMMAND` have no `default_member_permissions` field. |
| 03 | Remove `IS_COMPONENTS_V2` Flag | **Not Started** | No completion summary. `generateFlags` still accepts and applies `isComponentMessage`. |
| 04 | Interaction Token from `req.body` | **Not Started** | No completion summary. All handlers still read token via `response.req.body.token`. |
| 05 | `MODAL_SUBMIT` Routing | **Not Started** | No completion summary. No `MODAL_SUBMIT` block in `app.js`. |
| 06 | Fix `respondWithModal` Payload | **Not Started** | No completion summary. `respondWithModal` still uses `content`/`flags` shape instead of `custom_id`/`title`. |

No coding agent has produced code changes or completion summaries. The `plans/` directory is untracked and uncommitted.

---

## 3. Test Coverage

### Existing Coverage

- `discordresponsehelper.spec.js`: Tests `generateFlags` with single-argument calls (null and `true`). Passes against both the current code and the Plan 3 target.
- `timezones/timestamp.spec.js`: Covers timestamp parsing — unrelated to these plans.

### Gaps

- **Plan 3's actual bug is untested**: `generateFlags(true, true)` — the two-argument call that incorrectly sets `IS_COMPONENTS_V2` — is not tested anywhere. The bug will not be caught by the existing suite; neither will its fix be verified.
- **`respondWithModal` has no tests**: Plan 6 rewrites the function signature and payload shape entirely. No test exists to verify the before or after state.
- **`custom_id` encoding/parsing (Plan 1) has no tests**: The split-on-`:` routing logic, and the encoding in `handleGrantAchievementCommand` / `handleSetProfileCommand`, are untested.
- **`handleAssignAchievement` and `handleSetProfile` have no tests**: These are the highest-risk functions in the plans — they interact with the DB, handle authorization, and are changing in three plans simultaneously.
- **`handleAchievementsCommand` token extraction has no tests**: Plan 4 changes how `interactionToken` is obtained; no test verifies the before or after behavior.
- **`MODAL_SUBMIT` routing has no tests**: Plan 5 adds a new interaction type handler with no accompanying test.

---

## 4. Action Items

**Merge worktrees first (Team Lead responsibility)**
1. Run `git worktree list` to discover all coding agent worktrees. Merge each branch into the main worktree in plan order (Plans 3+6 → Plans 1+4 → Plan 2 → Plan 5). Resolve conflicts using full cross-plan context — do not pick one side blindly.
2. After all merges, run `npm test` to confirm no regressions before proceeding.

**Security (block merge)**
3. Add `memberCanManageRoles` check inside `handleAssignAchievement` and `handleSetProfile` before acting on the `encodedTargetId` from `custom_id`. Do this as part of Plan 1.

**Merge order rationale (to minimize conflicts)**
4. Merge Plans 3 and 6 together — both touch `discordresponsehelper.js` and must be coordinated (Plan 3 changes `generateFlags` before Plan 6 can correctly reference it).
5. Merge Plans 1 and 4 together — both change the same function signatures in `app.js` and `roles/profilehandler.js`. Use the combined signatures shown in Plan 4 as the source of truth.
6. Merge Plan 2 — isolated to `commands/commands.js`; safe to apply independently.
7. Merge Plan 5 — isolated to `app.js` routing; apply after Plans 1 and 4 to avoid conflicts.

**Documentation**
8. Create `AGENTS.md` before any agents execute plan updates. Define its structure once so all plans can append to it consistently rather than each agent creating a conflicting version.

**Testing**
9. Add a `generateFlags(true, true)` test case to `discordresponsehelper.spec.js` that asserts `IS_COMPONENTS_V2` is NOT set, validating Plan 3's fix.
10. Add tests for `respondWithModal` covering: correct `type`, `custom_id`, `title`, and `components` in the response payload.
11. Add a unit test for the `custom_id` parsing logic introduced in Plan 1 (split on `:`, route on `baseCustomId`, pass `encodedTargetId` through).
12. Add tests for `handleAssignAchievement` and `handleSetProfile` covering: authorized vs unauthorized callers, duplicate achievement guard, and successful assignment.
