# Plan: Add a Role via the Admin Page (DB-backed catalog)

## TL;DR

**What:** Turn the currently read-only Achievements & Roles dashboard (`public/`) into an admin tool that can **create a new managed role**. Submitting the form (a) creates the live Discord role via the existing `InstallGuildRole` path, (b) persists the role's definition to MongoDB, and (c) makes it appear immediately on the dashboard **and** usable in the bot's `/profile` / Grant-Achievement flows — no code deploy.

**Catalog re-architecture (per follow-up requirement):** Instead of merging static code with the DB, **MongoDB becomes the single source of truth for the role catalog.** The existing code-configured roles (`roles/achievementRoles.js`, `professionRoles.js`, `craftingRoles.js` + their `custom_id`s) are **removed from the import graph** and their data is moved into an **idempotent "up" migration script** that seeds them into a `ManagedRole` collection. Re-running the up-script is safe and rebuilds the baseline catalog after any DB wipe/change — that is the resilience mechanism ("resilient to database changes"). The static modules are deleted and all consumers read the DB-backed catalog through an in-memory cache.

**Decisions locked (from requirements Q&A):**

| Question | Decision |
|---|---|
| Persistence | **Create in Discord + save to catalog** (MongoDB-backed) |
| Auth | **Shared admin secret** (env var, checked server-side) |
| Role type | **Any managed type** — achievement, profession, or crafting |
| Icon input | **Both** file upload *and* image URL |
| Catalog source of truth | **MongoDB only.** Existing roles seeded via an idempotent up-migration; static role modules removed. |

---

## Key findings & constraints (from codebase research)

- **The admin page is read-only today.** `public/index.html` + `public/app.js` render `GET /api/achievements-and-roles` (`routes/dashboard.js`). There is **no write path and no authentication anywhere** in the app.
- **The catalog is static code, not data (today).** `mongo.js` persists only *per-member* records (`MemberRoles`, `MemberAchievement`, `MemberApiKey`). Role *definitions* live in three modules read synchronously at import time by:
  - `roles/catalog.js` — `getAchievementsPage`, `getAchievementCategoryOrder`, `rolesForFallback` (dashboard).
  - `roles/roleutils.js` — `CustomIdToRoleNameMap` / `RoleNameToCustomIdMap`, built once at import (used by `setUsersActiveRoleFromCustomId` in `roles/roles.js`).
  - `roles/achievements.js` — `isCustomIdAchievementRole`.
  - `roles/profilehandler.js` — the `/profile` dropdowns and the Grant-Achievement category flow.
  These are the exact consumers that must be repointed to the DB-backed catalog.
- **Role entry shape** (`roles/achievementRoles.js`, `craftingRoles.js`): `name` is a **getter** = `` `${short_name} - ${description}` ``, plus `short_name`, `description`, `custom_id`, `category` (achievements only), `color` (hex **integer**, e.g. `0xbf8ddc`), `icon` (base64 `data:image/png` URI, some inlined, some via `readFileSync` of `achievement_icons/*.png` at import), `mentionable`. Profession entries (`professionRoles.js`) are flatter: literal `name`, `custom_id`, `color`, `mentionable` (no `short_name`/`description`/`category`/icon). These shapes define the migration's seed documents.
- **`ACHIEVEMENT_CATEGORIES` is derived ordering config**, not role data: a static ordered name list in `achievementRoles.js` filtered to non-empty categories. Category *order* is presentation config and stays a small constant (or a tiny meta doc) — it is **not** a "configured role" and is not seeded as roles.
- **The Discord role name must equal the full `name` getter value.** Lookups depend on it: `getRoleIdByName` (`roleutils.js`) normalizes `role.name` (lowercase, strip spaces) and matches; `setUsersActiveRoleFromCustomId` maps `custom_id → role.name → getRoleIdByName(...)`. Mongo can't store a getter, so seed/normalize with a **computed** `name = "<short_name> - <description>"` (achievement/crafting) or the bare `name` (profession).
- **How roles are added to Discord** (`npm run register-roles` → `roles/installroles.js` → `AddGuildRoles`): filter out names already present (`GetGuildRoles`), `InstallGuildRole(GUILD_ID, role)` (POST create; extra fields ignored by Discord), then `ReorderRoles` positions new roles just under the top role. `InstallGuildRole` swallows errors (returns `undefined`) — the admin path needs stricter handling to capture the created role's `id`.
- **The Discord signature `verify` hook will 401 our POST.** `app.js:16` mounts `express.json({ verify: VerifyDiscordRequest(PUBLIC_KEY) })` **globally**. GET routes are unaffected (no body → `verify` never runs). But **any JSON `POST` body runs through `verify` and 401s** unless Discord-signed. The admin POST requires the verify hook to be **scoped to `/interactions`** (Phase 0). Highest-risk change — it touches the interactions endpoint.
- **`respondWithProfessionChoices` is hardcoded** (literal option list with `custom_id` constants), unlike crafting/achievement dropdowns which iterate arrays. It must be refactored to iterate the DB-backed profession catalog (Phase 6).
- **Deploy = Fly.io, single process, ephemeral filesystem.** No runtime file writes; icons stored as base64 in Mongo (Discord role icons cap at 256 KB, far under Mongo's 16 MB doc limit). The migration reads the PNGs from `achievement_icons/` etc. and encodes them into seed docs.
- **`node-fetch` is already a dependency** — reuse for server-side URL icon fetches; no new deps required.

---

## Architecture overview

```
Admin browser (public/, form)
   │  POST /api/admin/roles   { type, short_name, description, category,
   │  header: x-admin-secret   color, mentionable, iconSource, iconData|iconUrl }
   ▼
[Phase 0] plain express.json() parser  (verify hook now scoped to /interactions)
   ▼
[Phase 3] requireAdminSecret middleware  (constant-time compare vs env)
   ▼
[Phase 4] POST handler
   ├─ validate payload (per type)
   ├─ resolve icon → base64 data URI (upload | fetch URL)
   ├─ pre-check duplicate name via GetGuildRoles
   ├─ generate unique custom_id slug (vs DB)
   ├─ InstallGuildRole + position → capture discordRoleId
   ├─ insertManagedRole({...def, discordRoleId})
   └─ bust catalog + live-roles caches
   ▼
[Phase 2] Effective catalog  = MongoDB ManagedRole (in-memory cache, last-known-good)
   ├─ dashboard GET  (routes/dashboard.js, catalog.js)
   ├─ /profile dropdowns + Grant-Achievement (profilehandler.js)
   └─ setUsersActiveRoleFromCustomId map (roles.js / roleutils.js)

[Migration] npm run migrate:roles:up  → idempotent upsert of baseline roles into ManagedRole
            (source of truth for seed data; re-runnable after any DB change)
```

---

## Data model — new Mongo collection `ManagedRole`

Database `"BongoBot"`. One document per role (both migrated baseline roles and admin-created ones):

```js
{
  _id: ObjectId,
  type: 'achievement' | 'profession' | 'crafting',
  short_name: 'Speed Demon',
  description: 'Finished 1st in the guild Roller Beetle Race', // '' for profession
  category: 'Guild Activities',      // achievements only
  custom_id: 'speeddemon',           // unique key (used for idempotent upsert)
  color: 11354384,                   // integer (parsed from '#ad4110')
  mentionable: true,
  icon: 'data:image/png;base64,...', // base64 data URI, or null
  discordRoleId: '123456789012345678', // filled on create / by register-roles; may be null
  guildId: '<GUILD_ID>',
  source: 'migration' | 'admin',
  createdAt: ISODate,
  createdBy: 'migration' | 'admin'
}
```

Unique index on `{ guildId, custom_id }` — enforces uniqueness and backs the migration's idempotent upsert.

---

## Implementation phases

### Phase 0 — Scope the Discord `verify` hook (prerequisite, highest risk)

**File:** `app.js`

```js
// remove global:
// app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

// scope verify to /interactions, add plain parser for the rest:
app.post('/interactions',
  express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }),
  handleInteractions);          // existing handler body
app.use(express.json());        // plain parser for dashboard + admin API
```

Extract the current `/interactions` handler body into `handleInteractions(req, res)` (or keep inline with the scoped parser). Verify PING ack + one command + one component still work **before** anything else.

### Phase 1 — Mongo store for managed roles

**File:** `mongo.js` (follow existing connect-per-call pattern: `insertOne`, `updateOne`, `getFromCollection().toArray()`).

Add:
- `insertManagedRole(doc)` → returns the inserted `_id`
- `deleteManagedRole(id)` → `deleteOne('ManagedRole', { _id })` (used to roll back a DB-first insert when the Discord create fails)
- `upsertManagedRole(doc)` → `updateOne('ManagedRole', { guildId, custom_id }, { $set: doc }, { upsert: true })` (used by the migration)
- `getAllManagedRoles(guildId)`
- `updateManagedRoleDiscordId(custom_id, discordRoleId)`
- Ensure the unique index `{ guildId, custom_id }` (create on first use).

### Phase 2 — Up-migration: seed roles into the DB (idempotent) + remove static config

This phase implements "create an upscript … remove the code configured roles … resilient to database changes."

**New file:** `migrations/001-seed-roles.up.js` (npm script `"migrate:roles:up": "node ./migrations/001-seed-roles.up.js"`; optional paired `…down.js` to remove seeded rows).

The up-script:
1. Holds the full baseline role definitions (the data currently in the three static modules), reading icon bytes from `achievement_icons/`, `crafting_icons/`, `profession_icons/` via `readFileSync` and encoding to base64 data URIs. (Image files stay in the repo as assets; they are no longer imported by the running app.)
2. For each role, computes `name`, normalizes `color` to int, sets `source: 'migration'`, and **upserts** by `{ guildId, custom_id }` so re-running is safe and re-seeds after a wipe/schema change.
3. Logs a summary (inserted / updated / unchanged). Exits non-zero on failure.
4. (Optional) resolves `discordRoleId` for roles that already exist in the guild via `GetGuildRoles` name-match, so migrated rows link to live roles.

**Remove the code-configured roles:**
- Delete `roles/achievementRoles.js`, `roles/professionRoles.js`, `roles/craftingRoles.js`.
- Remove the now-unused role-specific `custom_id` constants from `customids.js` (keep the flow-control ids: `choose_achievement`, `choose_profession`, `choose_crafting`, `remove_all`, the dropdown ids, etc. — those are routing, not role data). Role `custom_id`s now live in `ManagedRole`.
- Move the achievement **category order** to a small config constant (e.g. `roles/categoryOrder.js`) or a `catalog_meta` doc — it is ordering, not role data.

### Phase 2b — DB-backed effective catalog (in-memory cache = resilience layer)

**New file:** `roles/effectiveCatalog.js`

- Reads `getAllManagedRoles(GUILD_ID)`; caches in memory with a short TTL (mirror `routes/dashboard.js`'s 60 s `rolesCache`) and keeps **last-known-good** on transient DB errors (this replaces the old static fallback).
- Normalizes each doc to `{ type, short_name, description, category, custom_id, name (computed), color (int + '#rrggbb'), mentionable, icon, discordRoleId }`.
- Async accessors used by all consumers: `getAchievementDefs()`, `getProfessionDefs()`, `getCraftingDefs()`, `getAllDefs()`, `getAchievementCategories()` (from the category-order constant, filtered to non-empty), `getRoleNameByCustomId(customId)`, `isCustomIdAchievementRole(customId)`, `generateUniqueCustomId(short_name)` (slug, checked vs DB), `invalidate()`.

**Repoint consumers to the effective catalog (async):**
- `roles/catalog.js` — `getAchievementsPage`, `getAchievementCategoryOrder`, `rolesForFallback` delegate to `effectiveCatalog` (keep pagination + icon-per-page + `#rrggbb`). `rolesForFallback` now means "DB roles minus icons" for the live-roles fetch fallback.
- `roles/roleutils.js` — replace import-time maps with `getRoleNameByCustomId` (cache-backed). Keep `getRoleIdByName` / `getRoleNameById` (operate on live Discord roles).
- `roles/roles.js` — `setUsersActiveRoleFromCustomId` uses `await getRoleNameByCustomId(customId)`.
- `roles/achievements.js` — `isCustomIdAchievementRole` delegates.
- `roles/profilehandler.js` — dropdown builders + Grant-Achievement flow read merged defs (profession dropdown in Phase 6).

Consumer call sites in `app.js` are already `await`ed, so the async conversion is mechanical.

### Phase 3 — Admin auth middleware (shared secret)

**New file:** `routes/adminAuth.js` — `requireAdminSecret(req, res, next)`: read `x-admin-secret` (or `Authorization: Bearer`), constant-time compare (`crypto.timingSafeEqual`) vs `process.env.ADMIN_SECRET` (reject if unset), `401` on mismatch. Add `ADMIN_SECRET=` to `.env.example`; set the real value in Fly secrets.

### Phase 4 — `POST /api/admin/roles` create-role route

Guarded by `requireAdminSecret`. **DB-first ordering** (persist, then create in Discord, roll back the DB row on failure):
1. **Validate** (rules table below); `400` on failure.
2. **Resolve icon → base64 data URI:** upload (`iconData` from browser `FileReader`, MIME + ≤256 KB) or URL (`node-fetch`, `https` only, `Content-Type: image/png|jpeg`, ≤256 KB, timeout) or none.
3. **Duplicate pre-check:** `GetGuildRoles(GUILD_ID)`; if computed `name` exists → `409`.
4. **`custom_id`:** `generateUniqueCustomId(short_name)`.
5. **Persist to DB first:** `insertManagedRole({...def, source:'admin', discordRoleId: null, guildId, createdAt})`; capture the inserted `_id`. (A unique-index violation on `{ guildId, custom_id }` → `409`.)
6. **Create the Discord role:** `InstallGuildRole(GUILD_ID, { name, color, mentionable, ...(icon && guildHasRoleIcons ? { icon } : {}) })`. **If it fails / returns falsy → `deleteManagedRole(_id)` and return `502`** (no orphaned Discord role, since creation failed).
7. **On success:** capture `.id`, `updateManagedRoleDiscordId(custom_id, id)`, and position under the top role (extract `createAndPositionRole` from `roles/roles.js`).
8. **Bust caches:** `effectiveCatalog.invalidate()` + dashboard `rolesCache`.
9. `201` with the normalized role.

DB-first means a failed Discord create leaves no orphaned live role — the only cleanup is deleting the just-inserted DB row (step 6). Guard the delete itself: if the rollback delete also fails, log and return an error naming the `custom_id`/`_id` so the stray row (with `discordRoleId: null`) can be reconciled.

### Phase 5 — Admin form (front-end)

**Files:** `public/index.html`, `public/app.js` (+ `npm run build:css`). The existing dashboard is already built from the **Tailwind Plus "Application UI" package** at `~/Downloads/application-ui-v4/html/` (v4.3 markup — `size-*`, `text-sm/6`, `inset-ring`, `outline -outline-offset-1`, `dark:*`). Build the Add-role UI from that same package for a consistent look. Use only the `html/` variant (ignore `react/`, `vue/`), swap sample `<img src>`/avatar placeholders for our data, and replace the components' fixed palette/placeholder values with ours.

**Container — slide-over drawer with a create form:** `overlays/drawers/06-create-project-form-example.html` is the anchor. It ships exactly the layout we need: branded header + close button, a scrollable stacked body, and a **sticky footer** with Cancel (secondary) + Save (primary) buttons; its body already includes a labeled text input, a `<textarea>`, and a radio `<fieldset>` we can repurpose. (Alternative if a centered modal is preferred over a slide-over: `overlays/modal-dialogs/04-simple-with-dismiss-button.html`.)

> **Dependency note:** the drawer's open/close uses Tailwind Plus's `@tailwindplus/elements` custom elements (`<el-dialog>`, `<el-dialog-panel>`, `command="show-modal"/"close" commandfor="drawer"`), loaded via a CDN `<script type="module">`. The current app inlines everything and has **no external scripts**. **Recommendation:** keep the drawer's markup/Tailwind classes but drive open/close with a few lines of vanilla JS (toggle a `hidden`/`data-closed` class), matching the existing self-contained `public/app.js` style — avoids adding a CDN runtime dependency. Include the `@tailwindplus/elements` script only if we decide we want its transitions for free.

**Form fields → component sources** (all under `~/Downloads/application-ui-v4/html/`):

| Field | Component file | Notes |
|---|---|---|
| "Add role" trigger (page header) | `headings/page-headings/01-with-actions.html` + `elements/buttons/06-buttons-with-leading-icon.html` | Primary button (with a `+` icon) in the header actions area, opening the drawer |
| Role **type** (achievement/profession/crafting) | `forms/select-menus/01-simple-native.html` | Native `<select>` — same wrapper (`grid grid-cols-1` + chevron svg) the dashboard's category filter already uses; drives which fields show |
| **Short name** | `forms/input-groups/01-input-with-label.html` | Text input |
| **Description** | `forms/textareas/01-simple.html` (present in the drawer) | Hidden/optional for profession |
| **Category** (achievements only) | `forms/select-menus/01-simple-native.html` | Options from `getAchievementCategoryOrder()` |
| **Color** | native `<input type="color">` (recommended, arbitrary hex → `#rrggbb`) | Package alt: `forms/radio-groups/09-color-picker.html` swatches — only if we want to constrain to preset brand colors from `colors.js` |
| **Mentionable** | `forms/toggles/05-with-right-label.html` (or `checkboxes/01-list-with-description.html`) | Boolean, default on |
| **Icon source** (Upload / URL / None) | radio `<fieldset>` from the drawer's "Privacy" block, or `forms/radio-groups/03-list-with-description.html` | Toggles the upload vs URL controls |
| **Icon file upload** | *(no dedicated file component in the package)* — build an `<input type="file" class="sr-only">` inside a dashed drop-zone using `feedback/empty-states/02-with-dashed-border.html` styling | Read to base64 via `FileReader`, send as `iconData` |
| **Icon URL** | `forms/input-groups/01-input-with-label.html` (`type="url"`) | Sent as `iconUrl` |
| **Admin secret** | `forms/input-groups/01-input-with-label.html` (`type="password"`) | Kept in memory / `sessionStorage`, sent as `x-admin-secret` |
| **Inline validation errors** | `forms/input-groups/03-input-with-validation-error.html` | Red outline + `aria-invalid` + `aria-describedby` error `<p>` per field |
| **Submit / Cancel** | drawer footer (`elements/buttons/01-primary-buttons.html` + `02-secondary-buttons.html`) | Save = submit, Cancel = close |
| **Request-level error banner** | `feedback/alerts/06-with-dismiss-button.html` (or `01-with-description.html`) | Surface `400/401/409/502` at the top of the drawer body |
| **Success feedback** (optional) | `overlays/notifications/01-simple.html` | Toast after `201` |

**Behavior:** the **type** select shows/hides fields (description + category + icon for achievements; description/icon for crafting; name/color/mentionable only for profession). Client-side validation mirrors the server rules table. On submit, read the file to base64 (if upload), POST JSON to `/api/admin/roles` with the `x-admin-secret` header; on `201` close the drawer and re-run `load()` to refresh the table; on `4xx/5xx` show the alert banner + per-field errors. Vanilla JS + Tailwind, matching the existing `public/app.js`.

### Phase 6 — Make new roles fully usable + register-roles from DB

- **Refactor `respondWithProfessionChoices`** to iterate `getProfessionDefs()`.
- **Rewrite `roles/installroles.js`** so `npm run register-roles` reads `ManagedRole` (via `getAllManagedRoles`) and creates any missing Discord roles (idempotent name-filter, reuse `AddGuildRoles`), writing back `discordRoleId`. This replaces the old static `[...ACHIEVEMENT_ROLES, ...]` import. Run order for a fresh guild: `npm run migrate:roles:up` → `npm run register-roles`.

---

## Validation rules

| Field | Rule |
|---|---|
| `type` | `achievement` \| `profession` \| `crafting` |
| `short_name` | required, 1–80 chars |
| `description` | required for achievement/crafting; optional for profession |
| computed `name` | ≤ 100 chars (Discord role-name limit) |
| `category` | achievements only; one of the configured category names |
| `color` | `#rrggbb` → int `0x000000`–`0xffffff`; default `0` |
| `mentionable` | boolean, default `true` |
| `custom_id` | server-generated slug; unique per `{ guildId, custom_id }` (never client-supplied) |
| `icon` (upload) | `data:image/png\|jpeg;base64,…`, decoded ≤ 256 KB |
| `icon` (url) | `https`, `Content-Type: image/png\|jpeg`, ≤ 256 KB, timeout |

---

## Edge cases & security

- **Verify-hook regression (Phase 0)** — top risk; ship/verify it as its own commit before the rest.
- **Resilience to DB changes** — the up-migration is idempotent (upsert by `custom_id`) and re-runnable after a wipe/schema change; the effective-catalog cache keeps last-known-good during transient outages. With static config removed, an **empty/unreachable DB on cold start** yields an empty catalog until the migration runs — so migration is a required deploy/bootstrap step (document in README + `AGENTS.md`).
- **Role icons need guild Boost Level 2 (`ROLE_ICONS`)** — store the icon in Mongo for the dashboard regardless; only send `icon` to Discord if the guild has the feature, else retry create without it + warn.
- **Duplicate names** — `GetGuildRoles` pre-check → `409`.
- **`custom_id` collisions** — server-generated + unique-index enforced; the `MESSAGE_COMPONENT` `default:` case already routes unknown custom_ids to `setUsersActiveRoleFromCustomId`, so DB roles are selectable once in the cache.
- **New achievement categories** — v1 restricts to configured category names; allowing new ones = also extending the category-order config (deferred).
- **SSRF via icon URL** — `https` only, enforce MIME/size/timeout, block private/loopback ranges (hardening); gated behind admin auth.
- **Admin secret** — constant-time compare, never logged, over `force_https`, stored in Fly secrets; consider rate-limiting.
- **Partial failure (DB-first ordering)** — DB insert precedes the Discord create; if the create fails the DB row is deleted (Phase 4 step 6), so no orphaned Discord role and no half-committed catalog entry. If the rollback delete itself fails, the stray row has `discordRoleId: null` and is logged for reconciliation.
- **Fly ephemeral FS** — icons only in Mongo; migration reads repo PNGs at seed time.

---

## Testing & verification

1. **Phase 0 first, isolated:** `/interactions` still verifies (PING + one command + one component).
2. **Migration:** run `migrate:roles:up` on an empty DB → all baseline roles present with correct `name`/`color`/`icon`/`category`; **run it again → no dupes, no changes** (idempotency); simulate a partial DB (delete a few docs) → re-run restores them.
3. **Unit (`jasmine`, `spec/`):** validation; `generateUniqueCustomId`; `#rrggbb`↔int; `name` computation/length; effective-catalog cache (DB populated → served; DB down → last-known-good).
4. **Auth:** wrong/missing secret → `401`; correct → proceeds.
5. **Happy path per type** (test guild): create achievement (icon upload), profession (icon URL), crafting → live Discord role exists + positioned, `ManagedRole` doc written, dashboard shows it after refresh, selectable via `/profile` (incl. refactored profession dropdown), achievements grantable.
6. **Failure paths:** duplicate `409`; bad icon `400`; boost-level icon rejection → created without icon + warning.
7. **Browser preview:** exercise the form, check console/network, screenshot the new role.

---

## Risks & rollback

- **Biggest risk:** Phase 0 breaking `/interactions`; keep it a standalone, verified commit.
- **Removing static config + async catalog refactor** touches many consumers. Mitigate by sequencing: Phase 0 → Phase 1 → Phase 2 migration (seed DB) + verify catalog reads from DB with static still present → then delete static modules → then Phases 3–6. Do not delete static modules until the DB path is proven, so rollback is `git revert` of the deletion.
- **Feature flag:** the write path is inert unless `ADMIN_SECRET` is set.

## Out of scope (future)

- Editing/deleting existing roles from the page (this plan is create-only, plus migration seeding).
- Per-admin identity / audit beyond `createdBy` (comes with Discord-OAuth auth).
- Creating new achievement *categories* from the UI.
- Discord-OAuth "Manage Roles" auth (deferred in favor of shared secret).
