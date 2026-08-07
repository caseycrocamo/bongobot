# Plan: Introduce a "Game" concept that groups Categories

## TL;DR

Add a **Game** entity (a group of Categories) scoped strictly to Category
management. Seed one game, **"Guild Wars 2"**, and attach every existing
category to it. Extend the admin dashboard so an admin can (a) add a Game and
(b) add a Category that **must** be assigned to a Game.

The single most important finding that shapes this plan: **"Category" is not a
first-class entity today.** There is no `Category` collection and no Mongoose —
the repo uses the native `mongodb` driver via helper functions in `mongo.js`.
Categories exist only as:

1. A hardcoded ordered string array `ACHIEVEMENT_CATEGORY_ORDER` in
   `roles/categoryOrder.js:1`, and
2. A `category` **string** field on `ManagedRole` documents of type
   `achievement` (see `migrations/001-seed-roles.up.js:20`,
   `routes/adminRoles.js:159`).

Categories are "materialized" from roles: `getAchievementCategories()`
(`roles/effectiveCatalog.js:84`) filters the hardcoded order down to the
categories actually present on at least one achievement role.

Therefore this feature requires **promoting Category to a first-class
collection** (documents with a Game reference), in addition to creating the
Game collection. To keep everything else working untouched, `ManagedRole` keeps
referencing its category by **name string** exactly as it does today — we do not
re-key roles. The new `Category` collection becomes the authoritative list of
category names and their owning Game.

**Recommended reference type:** `Category.gameId` as an **ObjectId ref** to the
`Game` collection (justified below), while `Category.name` remains the human/string
key that `ManagedRole.category` already points at.

---

## Current-state findings (grounding)

### Data layer
- `mongo.js` — native `mongodb` driver, DB name `"BongoBot"`. Generic helpers
  `insertOne` / `updateOne` / `getFromCollection` / `deleteOne` (all connect to
  the same client). Collection-specific wrappers follow a clear pattern:
  `ensureManagedRoleIndexes()` (`mongo.js:157`), `insertManagedRole`
  (`mongo.js:167`), `bulkUpsertManagedRoles` (`mongo.js:209`),
  `getAllManagedRoles` (`mongo.js:238`). **No Mongoose, no schemas** — shape is
  enforced in code (route validation + migration builders).
- Existing collections: `ManagedRole`, `MemberRoles`, `MemberAchievement`,
  `MemberApiKey`. IDs and references throughout are **strings** (`guildId`,
  `custom_id`, `discordRoleId`); `ObjectId` is used only for `_id`-based delete
  (`mongo.js:76`, `mongo.js:184`).

### How categories are created / stored / queried today
- **Stored:** as the `category` string on each achievement `ManagedRole` doc.
- **Created:** implicitly — when an admin creates an achievement role
  (`POST /api/admin/roles`, `routes/adminRoles.js:298`), they pick a category
  from `ACHIEVEMENT_CATEGORY_ORDER`; validation at `routes/adminRoles.js:159`
  rejects anything not in that hardcoded array. There is **no way to add a new
  category today** except editing `categoryOrder.js`.
- **Queried:** `getAchievementCategories()` (`roles/effectiveCatalog.js:84`)
  returns the ordered subset of `ACHIEVEMENT_CATEGORY_ORDER` present on roles.
  Consumers: dashboard payload `routes/dashboard.js:62`, admin drawer dropdown
  `public/app.js:303`/`321`, grant-achievement bot flow
  `roles/profilehandler.js:211`.

### Admin page
- Route wiring: `app.js:22` mounts `adminRolesRouter`; `app.js:27` serves
  `public/`; `app.js:28` mounts `dashboardRouter`.
- Frontend: `public/index.html` (login gate + dashboard + "Add role" slide-over
  drawer) and `public/app.js` (all logic, IIFE, vanilla JS + Tailmind classes).
  Category `<select>` markup: `public/index.html:189-201`.
- Auth: `requireAdminSecret` (`routes/adminAuth.js:16`) — constant-time compare
  of `x-admin-secret` header vs `process.env.ADMIN_SECRET`; inert (401) when the
  env var is unset. Session probe `GET /api/admin/session`
  (`routes/adminRoles.js:294`). Frontend stores the secret in `localStorage`
  with a 15-day TTL (`public/app.js:11-13`).
- CSS is compiled Tailwind: edit markup with utility classes, then
  `npm run build:css` (`package.json:20`) to regenerate `public/dist/output.css`.

### Seeding / migration pattern (follow this)
- Convention documented in `AGENTS.md:160-179`. Migrations are plain ESM
  scripts in `migrations/`, invoked by `package.json` scripts
  (`migrate:roles:up` / `:down`, `package.json:22-23`).
- `up` = **idempotent upsert** keyed on a unique tuple (`{ guildId, custom_id }`)
  via `bulkUpsertManagedRoles`; tags rows `source: 'migration'`
  (`migrations/001-seed-roles.up.js`). `down` = delete rows where
  `source: 'migration'` (`migrations/001-seed-roles.down.js`).
- Unique indexes are ensured in code before writes
  (`ensureManagedRoleIndexes`, `mongo.js:157`).
- **Node version caveat (from memory):** default `node` is v14; use Node 18 via
  nvm to run tests/build/migrations.

---

## Data model changes

### New collection: `Game`
Document shape (enforced in code, matching existing conventions):
- `_id`: ObjectId (auto)
- `guildId`: string — scope everything per guild, like `ManagedRole`
- `name`: string — e.g. `"Guild Wars 2"`
- `slug`: string — `slugify(name)` from `roles/catalogUtils.js:15`, stable key
- `source`: `'migration' | 'admin'` (mirror `ManagedRole`)
- `createdAt`: Date, `createdBy`: string
- **Unique index:** `{ guildId: 1, slug: 1 }`

### New collection: `Category`
Document shape:
- `_id`: ObjectId (auto)
- `guildId`: string
- `name`: string — **must equal** the string stored in `ManagedRole.category`
  (this is the join key that keeps existing roles working)
- `slug`: string — `slugify(name)`
- `gameId`: **ObjectId** ref → `Game._id` (the required Game assignment)
- `order`: number (optional) — preserve `ACHIEVEMENT_CATEGORY_ORDER` ordering
- `source`, `createdAt`, `createdBy` — as above
- **Unique index:** `{ guildId: 1, slug: 1 }`

### `ManagedRole` — no schema change
Roles continue to store `category` as a name string. We are **not** adding a
`gameId` to roles and **not** re-keying `category` to an ObjectId. This keeps
the entire downstream (dashboard, grant flow, effective catalog) untouched and
respects the scope boundary.

### Decision: ObjectId ref vs string for `Category.gameId` — **ObjectId ref**
Reasoning:
- A Category belongs to exactly one Game and the relationship is
  identity-based, not display-based — an ObjectId ref is the normalized, rename-
  safe choice (renaming a Game later won't orphan categories).
- The admin "add category" form selects from a list of existing Games; passing
  the Game's `_id` is natural and unambiguous.
- Trade-off: the rest of the repo leans on string keys (`custom_id`, `slug`),
  and reads would need an `ObjectId` join to resolve the game name. Since games
  are **not** displayed anywhere yet (explicit scope-out), no join is needed on
  the read path today — so the ObjectId ref costs us nothing now and is the
  cleaner long-term model.
- **Alternative considered:** store `gameSlug` string. Simpler joins, matches
  repo idioms, but rename-fragile. Flagged as an open decision below in case the
  user prefers string-slug consistency over normalization.

---

## Seed / migration script

New migration pair, following `001-seed-roles` conventions:
- `migrations/002-seed-games.up.js`
- `migrations/002-seed-games.down.js`
- `package.json` scripts: `migrate:games:up`, `migrate:games:down`.

### `up` behavior (idempotent)
1. `ensureGameIndexes()` and `ensureCategoryIndexes()` (unique on
   `{ guildId, slug }`).
2. **Upsert the Game** "Guild Wars 2" keyed on `{ guildId, slug: 'guildwars2' }`
   (`$set` fields, `upsert: true`). Capture its `_id` (re-read after upsert to
   get the id on both insert and match paths).
3. **Derive the category list.** Use the union of:
   - `ACHIEVEMENT_CATEGORY_ORDER` (the canonical ten, `roles/categoryOrder.js`), and
   - the distinct non-null `category` values actually present on `ManagedRole`
     for this `guildId` (defensive back-fill for any ad-hoc categories created
     via the admin route).
4. **Upsert one Category per name**, each keyed on `{ guildId, slug }`, setting
   `gameId` = Guild Wars 2 `_id`, `name`, `order` (index within
   `ACHIEVEMENT_CATEGORY_ORDER`, fallback high), `source: 'migration'`.
   Bulk-upsert (mirror `bulkUpsertManagedRoles`).
5. Log `inserted/updated/unchanged` counts like `001`.

**Idempotency:** all writes are upserts on stable slug keys, so re-running makes
no duplicate games/categories and only refreshes `gameId`/`order`. Safe to run on
every deploy (as the roles migration already is — `AGENTS.md:178`).

**Note on "re-parent existing categories":** because categories didn't exist as
documents before, "assigning all existing categories to the game" = creating a
Category document (with `gameId`) for each currently-in-use category name. No
`ManagedRole` rows are modified.

### `down` behavior
Delete `Category` and `Game` rows where `{ guildId, source: 'migration' }`
(mirrors `001-seed-roles.down.js`). Does not touch `ManagedRole`.

---

## `mongo.js` helper additions

Follow the `ManagedRole` helper pattern (`mongo.js:157-277`):
- `ensureGameIndexes()` / `ensureCategoryIndexes()` — unique `{ guildId, slug }`.
- `insertGame(doc)` → returns `insertedId`; map duplicate `err.code === 11000`.
- `getAllGames(guildId)` → array (projection `_id, name, slug`; `_id` needed so
  the admin category form can submit `gameId`).
- `upsertGame(doc)` / `bulkUpsertCategories(docs)` — for the migration.
- `insertCategory(doc)` → returns `insertedId`; duplicate-safe.
- `getAllCategories(guildId)` → array (`name`, `slug`, `gameId`, `order`),
  sorted by `order`.

---

## Backend API endpoints (new)

Add to `routes/adminRoles.js` (same router, same `requireAdminSecret` guard,
same JSON-parser mounting so `app.js:22` continues to cover them). Mirror the
existing validation style (trim, length caps, explicit 400/409 JSON errors) and
the `slugify`/duplicate handling used for roles.

1. **`POST /api/admin/games`** — create a Game.
   - Body: `{ name }`. Validate `name` is a 1–80 char string. Compute
     `slug = slugify(name)`; reject empty slug.
   - Insert `{ guildId, name, slug, source: 'admin', createdAt, createdBy }`.
     Duplicate slug → 409. Success → 201 `{ game: { id, name, slug } }`.

2. **`GET /api/admin/games`** — list Games for the dropdown.
   - Guarded by `requireAdminSecret` (the whole dashboard is already gated).
   - Returns `{ games: [{ id, name, slug }] }` from `getAllGames`.

3. **`POST /api/admin/categories`** — create a Category assigned to a Game.
   - Body: `{ name, gameId }`. Validate `name` (1–80 chars) and **`gameId`
     required** — must be a valid ObjectId that resolves to an existing Game for
     this `guildId` (reject 400 if missing/unknown; this enforces the "must
     assign to a Game" rule server-side, not just in the UI).
   - Compute `slug`; insert `{ guildId, name, slug, gameId, order: <next>,
     source: 'admin', createdAt, createdBy }`. Duplicate slug → 409.
   - Success → 201 `{ category: { id, name, slug, gameId } }`.
   - **Cache note:** if the add-role category dropdown is switched to read from
     the Category collection (see next section), invalidate/refresh so the new
     category is immediately selectable.

No new bot-facing or dashboard-facing endpoints — scope boundary respected.

---

## Category-list source switch (required for the feature to work)

Problem: the add-role drawer's category dropdown is currently populated from
`getAchievementCategories()`, which only returns categories that **already have a
role**. A newly created empty Category would never appear, so an admin could
never add the first role under it.

**Recommended change:** make the **Category collection** the authoritative source
for the admin add-role category dropdown.
- Add `getAllCategoriesOrdered(guildId)` (reads `Category`, sorted by `order`).
- In the dashboard payload (`routes/dashboard.js:62`) or a new lightweight
  endpoint, expose category **names** from the collection for the drawer.
- Keep `getAchievementCategories()` (materialized-from-roles) for the dashboard
  **filter + sort** if you want the filter to show only populated categories, or
  switch it too for consistency. Recommendation: switch both to the collection so
  "add category" is immediately reflected everywhere in the admin UI.
- Keep the bot grant-flow (`roles/profilehandler.js:211`) on the
  materialized-from-roles list (it should only show categories that actually have
  achievements) — this also keeps us clear of the scope boundary.

This is a design decision worth confirming (see Open Questions).

---

## Admin frontend changes

All in `public/index.html` + `public/app.js`, following the existing
login-gate / drawer / toast / field-error patterns already in `app.js`.

1. **Header controls** (`public/index.html:43` area): add **"Add game"** and
   **"Add category"** buttons next to the existing "Add role" button, styled with
   the same indigo utility classes.

2. **"Add game" flow:** a small drawer or modal reusing the `role-drawer`
   structure (`public/index.html:117`) with a single `name` text field + Save.
   On submit → `POST /api/admin/games` with `x-admin-secret`; on 201 show the
   existing toast, refresh the games list. Reuse `getSecret()`, `showToast`,
   `showAlert`, 401-relogin handling (`public/app.js:474-551`).

3. **"Add category" flow:** a drawer with:
   - `name` text field (required, 1–80).
   - **Game `<select>` (required)** — populated from `GET /api/admin/games`;
     mirror the existing category-select markup at
     `public/index.html:189-201` and the `populateRoleCategorySelect` helper
     (`public/app.js:321`). Client-side validation requires a selection, and the
     server also enforces it.
   - On submit → `POST /api/admin/categories`; on 201 refresh the category list
     so the new category appears in the add-role drawer's category dropdown.

4. **Existing add-role drawer:** repoint its category dropdown to the
   collection-backed category list (per the section above). The required-category
   validation for achievements (`public/app.js:449`) stays as-is.

5. Run `npm run build:css` after editing markup so new utility classes land in
   `public/dist/output.css`.

---

## Ordered task breakdown

**Phase 1 — Data layer & migration**
1. `mongo.js`: add `ensureGameIndexes`, `ensureCategoryIndexes`, `insertGame`,
   `getAllGames`, `upsertGame`, `insertCategory`, `getAllCategories`,
   `bulkUpsertCategories`.
2. `migrations/002-seed-games.up.js` + `.down.js`: seed "Guild Wars 2" and a
   Category per existing category name (idempotent upserts).
3. `package.json:22`: add `migrate:games:up` / `migrate:games:down` scripts.
4. Run migration with Node 18; verify in Mongo that `Game` has one doc and
   `Category` has all ten (plus any admin-created) with correct `gameId`.

**Phase 2 — Backend API**
5. `routes/adminRoles.js`: add `POST /api/admin/games`, `GET /api/admin/games`,
   `POST /api/admin/categories` (validation, dup handling, gameId existence check).
6. Add a category-list read used by the admin drawer (via `dashboardRouter` or a
   new admin GET) sourced from the `Category` collection; wire cache invalidation
   consistent with `invalidateCatalog()` / `invalidateRolesCache()`
   (`routes/adminRoles.js:260-261`).

**Phase 3 — Admin frontend**
7. `public/index.html`: add "Add game" / "Add category" buttons + their
   drawers/forms (Game dropdown in the category form).
8. `public/app.js`: add fetch + validation + toast/error handlers for both new
   flows; repoint the add-role category dropdown to the collection list.
9. `npm run build:css`.

**Phase 4 — Verify** (see below).

---

## Verification
- **Migration idempotency:** run `migrate:games:up` twice; second run reports
  `inserted=0` and no duplicate `Game`/`Category` docs (`db.Game.countDocuments`,
  `db.Category.countDocuments`). Confirm every `Category.gameId` equals the
  Guild Wars 2 `_id`.
- **API (with `ADMIN_SECRET` set):**
  - `GET /api/admin/games` → the seeded game; without the header → 401.
  - `POST /api/admin/games` `{name}` → 201; repeat same name → 409.
  - `POST /api/admin/categories` without `gameId` → 400; with unknown `gameId`
    → 400; with valid `gameId` → 201.
- **UI:** sign in, add a Game, add a Category (Game dropdown required and
  rejects empty), then open Add role and confirm the new category is selectable
  and a role can be created under it.
- **Regression:** existing add-role flow, dashboard category filter/sort
  (`public/app.js:256`), and the bot grant-achievement category step
  (`roles/profilehandler.js:211`) still behave as before.
- **Tests:** `npm test` (jasmine) still green; consider a pure-helper spec for
  any new `catalogUtils`-style logic, mirroring `catalogUtils.spec.js`.

---

## Decisions & scope boundaries
- **Category promoted to a collection** (it wasn't one). `ManagedRole` still
  references category by **name string** — no re-keying, no `gameId` on roles.
- **`Category.gameId` = ObjectId ref** (normalized, rename-safe). String-slug
  alternative noted.
- **Games are storage/admin only** — not surfaced to the bot, dashboard display,
  achievements/roles logic, or any user-facing feature (explicit scope-out).
- Seed = one Game ("Guild Wars 2") + one Category per currently-used category
  name, all pointing at that game. Idempotent upserts; `down` removes only
  `source: 'migration'` rows.
- New endpoints reuse `requireAdminSecret`; write path stays inert without
  `ADMIN_SECRET`.

## Resolved decisions (confirmed by user 2026-08-06)
1. **`gameId` type → ObjectId ref.** Normalized, rename-safe. `Category.gameId`
   stores the Game's `_id`; string-slug alternative rejected.
2. **Category dropdown source → repoint to the Category collection.** The admin
   add-role category dropdown reads from the new `Category` collection so newly
   added (empty) categories are immediately selectable. Per section
   "Category-list source switch", switch both the add-role dropdown and the
   dashboard filter to the collection; keep the bot grant flow
   (`roles/profilehandler.js:211`) on the materialized-from-roles list.
3. **Add-game / add-category UI shape → separate slide-over drawers**, matching
   the existing "Add role" drawer pattern (minimal deviation).

### Still-default (not raised, applying the plan's recommendation)
4. **Uniqueness scope:** category slug unique **per guild** (recommended), since
   `ManagedRole.category` is just a name and per-guild avoids ambiguous
   role→category joins. Flag if you'd prefer per-game.
