# Split Tasks — Add Role via Admin Page

Companion to [add-role-via-admin-page-plan.md](add-role-via-admin-page-plan.md). Read that plan for full rationale.
This file pins the **fixed contracts** every subagent codes against, so files can be built concurrently.

## Locked architectural decisions

1. **Static role data is COPIED (not reconstructed) into `migrations/seed-data/`** and self-containized.
   The originals (`roles/achievementRoles.js`, `professionRoles.js`, `craftingRoles.js`) are **deleted only at
   integration** by the team lead, after grep confirms zero consumers import them. Reason: `achievementRoles.js`
   has per-role `name` getters that vary (some `short_name`, some `short_name - description`) and 33 inline
   base64 icons with no 1:1 disk file — importing the resolved objects is the only lossless path.
2. **MongoDB `ManagedRole` is the single source of truth for the running app.** All consumers read the
   DB-backed `roles/effectiveCatalog.js` cache. Static modules are removed from the running-app import graph.
3. Two pinned contracts below (`mongo.js` + `effectiveCatalog.js`) — do not deviate from these signatures.

---

## CONTRACT A — `mongo.js` new exports (ManagedRole store)

Collection: `"ManagedRole"` in db `"BongoBot"`. Follow the existing connect-per-call pattern.

```js
export async function ensureManagedRoleIndexes()                                 // createIndex({guildId, custom_id}, {unique:true}); safe to call repeatedly
export async function insertManagedRole(doc)                                     // returns inserted _id (ObjectId)
export async function deleteManagedRole(id)                                      // deleteOne by _id; returns deletedCount
export async function upsertManagedRole(doc)                                     // updateOne({guildId:doc.guildId, custom_id:doc.custom_id}, {$set:doc}, {upsert:true}); returns {matchedCount, modifiedCount, upsertedCount}
export async function getAllManagedRoles(guildId)                                // find({guildId}).toArray(); returns [] on error
export async function updateManagedRoleDiscordId(guildId, custom_id, discordRoleId) // $set discordRoleId
```

`upsertManagedRole` needs the native driver (upsert option) — implement directly with the shared `client`
(connect → db("BongoBot").collection("ManagedRole").updateOne(..., {upsert:true}) → close in finally).
`insertManagedRole` should call `ensureManagedRoleIndexes()` first, then insert.

## ManagedRole document shape (written by migration + admin route)

```js
{
  type: 'achievement'|'profession'|'crafting',
  short_name, description /* '' for profession */, category /* achievements only, else null */,
  custom_id, color /* integer */, mentionable /* bool */, icon /* base64 data URI or null */,
  name /* computed Discord role name string */,
  discordRoleId /* string or null */, guildId, source /* 'migration'|'admin' */,
  createdAt /* Date */, createdBy /* 'migration'|'admin' */
}
```

## CONTRACT B — `roles/effectiveCatalog.js` exports

Normalized def object:
```js
{ type, short_name, description, category, custom_id, name, color /* int */, colorHex /* '#rrggbb' */, mentionable, icon, discordRoleId }
```
Exports (all async unless noted):
```js
getAllDefs()                          // def[]
getAchievementDefs()                  // defs where type==='achievement'
getProfessionDefs()                   // type==='profession'
getCraftingDefs()                     // type==='crafting'
getAchievementCategories()            // ordered category names (from categoryOrder), filtered to non-empty vs current achievement defs
getRoleNameByCustomId(customId)       // string|undefined
getCustomIdByRoleName(roleName)       // string|undefined
isCustomIdAchievementRole(customId)   // boolean
generateUniqueCustomId(short_name)    // slug string, unique vs DB catalog
invalidate()                          // (sync) clears the in-memory cache
```
Impl: 60s TTL in-memory cache over `getAllManagedRoles(process.env.GUILD_ID)`; keep **last-known-good** on DB
error (return stale cache instead of throwing). `colorHex = '#' + Number(color).toString(16).padStart(6,'0')`.
Imports only `../mongo.js` (wait: it's at repo root → `../mongo.js`) and `./categoryOrder.js`. Return **copies**
so callers can't mutate the cache.

## CONTRACT C — admin POST `/api/admin/roles`

Request JSON: `{ type, short_name, description, category, color:'#rrggbb', mentionable, iconSource:'upload'|'url'|'none', iconData?/*data URI*/, iconUrl? }`.
Header: `x-admin-secret`. Responses: 201 (normalized role), 400 (validation), 401 (auth), 409 (dup name / custom_id), 502 (Discord create failed).

## CONTRACT D — helpers other files must export

- `roles/roles.js` exports `createAndPositionRole(role)` → calls `InstallGuildRole(GUILD_ID, role)`, returns the
  created role obj (has `.id`) or falsy on failure, then positions it just under the top role.
- `routes/dashboard.js` exports `invalidateRolesCache()` → resets its internal `rolesCache`.
- `roles/categoryOrder.js` exports `export const ACHIEVEMENT_CATEGORY_ORDER = ['Elementalist','Mesmer','Necromancer','Thief','Engineer','Ranger','Revenant','Warrior','Guild Activities','General'];`

---

## Task list (one file each; waves = dependency layers)

**Wave 1 — foundation (parallel):**
- W1-app: `app.js` — Phase 0 scope verify hook to `/interactions`; plain `express.json()` for the rest. Do NOT add admin router (team lead wires it).
- W1-mongo: `mongo.js` — Contract A.
- W1-auth: `routes/adminAuth.js` (new) + add `ADMIN_SECRET=` to `.env.example` — Phase 3.
- W1-catorder: `roles/categoryOrder.js` (new) — Contract D constant.
- W1-catalog-cache: `roles/effectiveCatalog.js` (new) — Contract B.
- W1-migration: copy 3 static role files → `migrations/seed-data/` self-containized (inline custom_id literals; fix `../colors.js`→`../../colors.js`, `../achievement_icons/`→`../../achievement_icons/`); create `migrations/001-seed-roles.up.js` + `001-seed-roles.down.js`; add `migrate:roles:up`/`migrate:roles:down` npm scripts.

**Wave 2 — consumers + admin route + UI (parallel, code against contracts above):**
- W2-roleutils: `roles/roleutils.js` — drop static imports + maps; keep `getRoleIdByName`, `getRoleNameById`.
- W2-achievements: `roles/achievements.js` — `isCustomIdAchievementRole` async→delegate; keep `getUsersAchievements`.
- W2-catalog: `roles/catalog.js` — delegate to effectiveCatalog; functions become async; keep pagination + `#rrggbb`.
- W2-roles: `roles/roles.js` — `setUsersActiveRoleFromCustomId` uses `await getRoleNameByCustomId`; export `createAndPositionRole`.
- W2-achhandler: `roles/achievementHandler.js` — repoint to effectiveCatalog (async); operate on copies.
- W2-profile: `roles/profilehandler.js` (+ remove role-constant exports from `customids.js`) — dropdowns + grant flow + Phase 6 profession refactor from DB.
- W2-dashboard: `routes/dashboard.js` — await async catalog fns; export `invalidateRolesCache`.
- W2-installroles: `roles/installroles.js` — read `ManagedRole`, create missing Discord roles, write back `discordRoleId`.
- W2-adminroute: `routes/adminRoles.js` (new) — Contract C, DB-first flow.
- W2-ui: `public/index.html` + `public/app.js` — Add-role slide-over drawer (vanilla JS, no CDN); run `npm run build:css`.

**Wave 3 — integration (team lead):** mount admin+dashboard routers in `app.js`; delete original static role
files after grep shows no importers; `npm test`; verify against plan.
