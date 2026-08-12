# Place new Discord roles BELOW a configurable anchor list

## TL;DR

Today, every role BongoBot creates is forced near the **top** of the guild
hierarchy (`highestPosition - 1`), which visually hoists it above almost
everything. We want new roles placed **below** a configurable set of "anchor"
roles stored in Mongo. The first anchor is **Admin** (`roleId =
1536874743880228865`).

Approach (scoped per the answered questions): **DB + seed migration only** — no
admin UI or REST endpoints this round. Add a `RolePositionAnchor` collection,
seed the Admin anchor via a numbered migration, add mongo accessors, and rewrite
the two placement code paths (`createAndPositionRole` for the admin add-role
flow, and `ReorderRoles` for the bulk `register-roles` flow) to compute the
target position as **just below the lowest-positioned anchor role present in the
guild**. Placement is **best-effort**: attempt the target below the anchors and,
if Discord rejects it (e.g. an anchor sits above the bot's own top role), fall
back to the current default and log a warning — the role create never fails on
positioning alone.

## Background / current behavior

- Discord role positions: **higher number = higher in the list**. `@everyone` is
  position 0. A brand-new role is created at position 1 (bottom).
- `roles/roles.js` has two placement paths, both of which currently push the new
  role to the top:
  - `createAndPositionRole(role)` — used by the admin add-role API
    ([routes/adminRoles.js:240](routes/adminRoles.js), :244). Creates the role,
    fetches live roles, computes `highestPosition`, then PATCHes the new role to
    `Math.max(highestPosition - 1, 1)`.
  - `AddGuildRoles(roleList)` → `ReorderRoles(roleIds, currentRoles)` — used by
    the `register-roles` bulk installer ([roles/installroles.js](roles/installroles.js)).
    Same `highestPosition - 1` logic, applied to a batch of new role ids.
- Position PATCH goes through `ModifyGuildRolePosition(guildId, [{id, position}])`
  in [discordclient.js:89](discordclient.js) (Discord `PATCH /guilds/{id}/roles`).
- Mongo access is centralized in [mongo.js](mongo.js); collections follow a
  consistent shape (`ManagedRole`, `Game`, `Category`) with `ensure*Indexes`,
  insert/getAll helpers, and `{ guildId, ... }` documents.
- Migrations are numbered `.up.js` / `.down.js` pairs under
  [migrations/](migrations) with `migrate:*:up|down` npm scripts in
  [package.json](package.json). Down migrations delete by `{ guildId, source:
  'migration' }`.

## Design decisions

- **Anchor identity = Discord `roleId`** (stable), with an optional `name`/label
  stored for readability. Placement matches by `roleId` against live guild roles;
  the stored name is not authoritative.
- **"Below all anchors" = below the lowest-positioned anchor.** With multiple
  anchors, compute the **minimum** `position` among anchors that currently exist
  in the guild, and target `minAnchorPosition - 1`. Order among anchors is
  irrelevant to placement, so no `order` field is needed.
- **Best-effort placement (per answer):** attempt the computed target; if the
  position PATCH fails or the anchors can't be resolved, fall back to the
  existing default (`highestPosition - 1`) and log a warning. Never fail the role
  create because of positioning. Note that `ModifyGuildRolePosition` currently
  swallows errors and returns `console.error`'s `undefined` on failure — the
  fallback must key off that (see Further Considerations).
- **Scope = DB + migration only.** No new Express routes, no `public/` UI. The
  list is edited directly in Mongo for now. Leave clean extension points (mongo
  helpers already REST-friendly) for a later UI phase.
- **New collection name:** `RolePositionAnchor`. Document shape:
  `{ guildId, roleId, name, source, createdAt, createdBy }`.
- **Fallback when no anchors configured/found:** preserve today's behavior
  (`highestPosition - 1`) so nothing regresses before the migration is run.

## Steps

### Phase 1 — Data layer

1. **Add `RolePositionAnchor` mongo helpers** in [mongo.js](mongo.js), mirroring
   the `Game`/`Category` sections:
   - `ensureRolePositionAnchorIndexes()` — unique index on `{ guildId, roleId }`.
   - `insertRolePositionAnchor(doc)` — `await ensure*`, insert; let duplicate-key
     (11000) propagate for idempotency handling by the migration.
   - `getAllRolePositionAnchors(guildId)` — projection `{ _id: 0, roleId: 1,
     name: 1 }`, returns `[]` on error (match `getAllManagedRoles` resilience).
   - (Optional, for future UI) `deleteRolePositionAnchor(guildId, roleId)` —
     include now so the surface is complete, even though no route calls it yet.

2. **Seed migration** `migrations/003-seed-role-position-anchors.up.js` +
   `.down.js`, following [migrations/002-seed-games.up.js](migrations/002-seed-games.up.js)
   / `.down.js`:
   - `up`: `ensureRolePositionAnchorIndexes()` then upsert one anchor
     `{ guildId, roleId: '1536874743880228865', name: 'Admin', source:
     'migration', createdAt, createdBy: 'migration' }`. Use an upsert keyed on
     `{ guildId, roleId }` so re-running is idempotent (mirror `upsertGame`), or a
     guarded insert that ignores 11000.
   - `down`: `removeFromCollection('RolePositionAnchor', { guildId, source:
     'migration' })`.
   - Add `migrate:anchors:up` / `migrate:anchors:down` scripts to
     [package.json](package.json).

### Phase 2 — Placement logic

3. **Add a shared position helper** in [roles/roles.js](roles/roles.js), e.g.
   `computeTargetPositionBelowAnchors(currentRoles)`:
   - Fetch anchors via `getAllRolePositionAnchors(process.env.GUILD_ID)`.
   - Build a set of anchor `roleId`s; find matching entries in `currentRoles`;
     collect their `position` values.
   - If any anchor positions found: return `Math.max(minAnchorPosition - 1, 1)`.
   - Else return the current default: `Math.max(highestPosition - 1, 1)` (compute
     `highestPosition` from `currentRoles`). Return a small result object or a
     flag indicating whether it was anchor-derived, so callers can log intent.
   - Guard against non-array `currentRoles` (as existing code does).

4. **Rewrite `createAndPositionRole`** ([roles/roles.js:88](roles/roles.js)):
   - After `InstallGuildRole` + `GetGuildRoles`, call the helper to get the target
     position, PATCH via `ModifyGuildRolePosition`.
   - Best-effort: if the PATCH indicates failure, retry once at the default
     position; log a warning either way. Return `created` unchanged (callers in
     `adminRoles.js` only check `created.id`).

5. **Rewrite `ReorderRoles`** ([roles/roles.js:20](roles/roles.js)):
   - Replace the inline `highestPosition - 1` with the shared helper's target,
     applied to every new `roleId` in the batch: `roleIds.map(id => ({ id,
     position: target }))`.
   - Keep the existing `setTimeout(..., 2000)` deferral in `AddGuildRoles` (it
     waits for role creation to settle before reordering).

### Phase 3 — Verification

6. Run through the Verification section below.

## Relevant files

- [roles/roles.js](roles/roles.js) — `createAndPositionRole` (:88), `ReorderRoles`
  (:20), `AddGuildRoles` (:8). Primary edit site; add the shared helper here.
- [mongo.js](mongo.js) — add `RolePositionAnchor` section (model on the `Game`
  block, :282–339; resilience patterns at `getAllManagedRoles` :238).
- [discordclient.js:89](discordclient.js) — `ModifyGuildRolePosition` (note: error
  handling swallows failures → returns `undefined`; relevant to best-effort logic).
- [routes/adminRoles.js:240](routes/adminRoles.js) — admin add-role caller of
  `createAndPositionRole` (no change needed, but verify behavior).
- [roles/installroles.js](roles/installroles.js) — `register-roles` bulk caller of
  `AddGuildRoles` (no change needed).
- [migrations/002-seed-games.up.js](migrations/002-seed-games.up.js) /
  `.down.js` — template for the new migration.
- [package.json](package.json) — `migrate:*` script conventions.

## Verification

- **Unit-ish / logic:** the repo uses Jasmine (`npm test`). Add a spec for the
  position helper (mirror [roles/catalogUtils.spec.js](roles/catalogUtils.spec.js))
  covering: anchors present → `minAnchorPosition - 1`; no anchors configured →
  `highestPosition - 1`; anchors configured but none present in guild → default;
  multiple anchors → uses the lowest. Factor the helper to accept
  `(currentRoles, anchorRoleIds)` (pure) so it's testable without Mongo.
- **Migration:** run `npm run migrate:anchors:up`, confirm the Admin anchor
  document exists in `RolePositionAnchor`; run `:down`, confirm it's removed.
  (Uses Node 18 via nvm per the toolchain note — see memory.)
- **Live (admin add-role):** with the bot running against the test guild, create a
  role through the admin page and confirm in Discord's role list that it lands
  **directly below Admin**, not at the top. Repeat with the Admin anchor removed
  from the DB to confirm the fallback (top-ish) behavior.
- **Live (bulk):** run `npm run register-roles` and confirm newly created roles
  land below Admin.
- **Edge:** temporarily move Admin above BongoBot's own top role and create a
  role; confirm the create still succeeds (best-effort fallback) and a warning is
  logged.

## Further considerations

- **`ModifyGuildRolePosition` swallows errors** (returns `console.error`'s
  `undefined` on non-2xx). For real best-effort detection the plan should either
  (a) inspect the returned array (a successful PATCH returns the full role list)
  and treat non-array as failure, or (b) make `ModifyGuildRolePosition` surface
  success/failure. Recommendation: (a) — check `Array.isArray(result)` in the
  caller, no signature change. Flagging so it's a conscious choice.
- **Node engine mismatch:** [package.json](package.json) declares `node 16.x`, but
  the memory note says use Node 18 (nvm) for tests/build. Use Node 18 for
  migration + test runs.
- **Future UI phase (out of scope now):** the mongo helpers are intentionally
  REST-shaped so a later phase can add `GET/POST/DELETE /api/admin/role-anchors`
  and an admin-page section (like Games/Categories) with minimal new work. A
  cache layer (like `effectiveCatalog`) is likely unnecessary given how rarely
  roles are created, but could be added if placement latency matters.
- **Anchor validation:** we don't verify the seeded `roleId` still exists in the
  guild — unknown anchors are simply skipped when computing the min position,
  which is the desired graceful behavior.
