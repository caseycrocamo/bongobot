# Games & Categories overview + per-game filtering

## TL;DR

Add a **Games overview** panel above the Achievements table on the dashboard
(`public/index.html` + `public/app.js`). Render **one card per game**, each card
listing the game's categories via a **category dropdown scoped to that game**
(plus achievement counts). Selecting a category (or "All categories") inside a
card filters the Achievements table to that game/category; only one card's
filter is active at a time, and a global "Show all" clears it. This replaces the
single global `#category-filter` select in the Achievements header.

To make this work, extend the existing public endpoint
`GET /api/achievements-and-roles` to return a `games` array where each game
embeds its categories and per-category achievement counts, so the client can
group, count, and map each achievement's `category` name back to its owning game.

Recommended approach: keep the server as the source of truth for the
game→category grouping and counts (categories can outnumber a single page of
achievements), and keep the client filter logic a single "active filter" of
shape `{ gameId, category }`.

## Steps

### Phase 1 — Backend: expose games with nested categories + counts

1. **Add a grouping helper** in `roles/effectiveCatalog.js` (or a small new
   function in `roles/catalog.js`) — `getGamesWithCategories()`:
   - Load games via `getAllGames(guildId)` → `{ _id, name, slug }`.
   - Load categories via `getAllCategories(guildId)` → `{ name, slug, gameId, order }`
     (already sorted by `order`).
   - Group categories under their game by matching `String(category.gameId) ===
     String(game._id)`. Categories whose `gameId` matches no game go into a
     synthetic **"Ungrouped"** bucket (id `null`).
   - Return `[{ id: String(_id), name, slug, categories: [{ name, slug }] }, …]`.
   - Reuse the existing TTL/last-known-good caches (`loadCategoryNames` already
     caches categories; add a parallel cached games loader mirroring it, and
     wire `invalidate*` so admin create actions bust it — see Step 3).
   - Note the ObjectId vs string mismatch: `getAllGames` returns `_id` as an
     ObjectId while `getAllCategories` returns `gameId` as an ObjectId too;
     compare via `String()` on both.

2. **Compute per-category achievement counts** server-side in
   `roles/catalog.js`. Add `getAchievementCategoryCounts()` that loads
   `getAchievementDefs()` and returns a `Map`/object of `categoryName -> count`
   across ALL achievement defs (not just the current page — client `PAGE_SIZE`
   is 50 and counts must be total-accurate). A per-game total is the sum of its
   categories' counts.

3. **Cache invalidation**: the admin routes already call `invalidateCategories()`
   on category create (`routes/adminRoles.js:373`) and `invalidateCatalog()` on
   role create. Add an equivalent `invalidateGames()` and call it after
   `insertGame` (`routes/adminRoles.js:329`) so a newly added game appears
   without a restart. Ensure the new games cache is cleared by it.

4. **Extend the dashboard response** in `routes/dashboard.js` (the
   `GET /api/achievements-and-roles` handler, currently building
   `{ achievements, roles }`):
   - Attach `achievements.games = await getGamesWithCategories()` with each
     category carrying its count (fold Step 2 counts into the nested category
     objects: `{ name, slug, count }`, and add a `count` per game).
   - Keep the existing `achievements.categories` flat ordered array for backward
     compatibility / fallback (the add-role drawer's category `<select>` and the
     sort order still use it — see `public/app.js:335` `populateRoleCategorySelect`).

### Phase 2 — Frontend markup: Games overview panel

5. **Add a `#games-overview` section** in `public/index.html`, placed between the
   summary stats section (`#summary-stats`, ends ~line 76) and the Achievements
   section (`#achievements-section`, starts line 79). Structure:
   - A responsive card grid (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
     gap-5`) matching the existing card styling used by `#summary-stats`
     (`rounded-lg bg-white … dark:bg-gray-800/…`).
   - A container `#games-overview-cards` that JS fills; plus loading/empty states
     mirroring the Achievements section's `-loading`/`-empty` pattern.
   - Each card (built in JS) contains: game name heading, a total-achievement
     count badge, and a **scoped category `<select>`** with a leading
     `All <game> categories` option followed by one option per category showing
     `name (count)`.

6. **Remove the global `#category-filter`** block from the Achievements header
   (`public/index.html:82–92`) since category selection now lives per-card. Keep
   the `<label … sr-only>`/accessibility pattern for the new per-card selects.
   Optionally replace the header control with a **"Show all" / clear-filter**
   button that is visible only when a filter is active.

### Phase 3 — Frontend logic: render cards + single active filter

7. **Extend `state`** in `public/app.js` (currently `{ items, categoryOrder,
   selectedCategory }`, line 4):
   - Add `state.games = []` (from response) and replace `selectedCategory` with
     `state.activeFilter = { gameId: null, category: null }` (null = show all).
   - Build a `categoryToGameId` map from `state.games` for mapping an
     achievement's `item.category` to its game when filtering by whole game.

8. **Render the cards** — add `renderGamesOverview()`:
   - For each game, create a card and its scoped `<select>` (options = All +
     categories with counts).
   - Wire each select's `change` handler to set
     `state.activeFilter = { gameId, category: value || null }` (empty value =
     the game's "All categories"), then **reset every other card's select** to
     its placeholder (single active filter across cards), then call
     `renderAchievements()`.
   - Reflect the active filter's selected option so re-renders keep the right
     card showing the selection.

9. **Update `renderAchievements()`** (`public/app.js:297`):
   - Filter `state.items` by the active filter:
     - if `activeFilter.category` set → `item.category === activeFilter.category`;
     - else if `activeFilter.gameId` set → `categoryToGameId[item.category] === activeFilter.gameId`;
     - else → no filter.
   - Keep the existing `sortByCategory(filtered, state.categoryOrder)` sort.

10. **Update `load()`** (`public/app.js:321`): read `games` from
    `data.achievements`, set `state.games`, call `renderGamesOverview()`, drop
    the `populateCategoryFilter` call (removed) but keep
    `populateRoleCategorySelect(state.categoryOrder)` for the add-role drawer.

11. **Refresh after admin create actions**: after a successful game/category/role
    create (the existing drawer submit handlers), re-run `load()` (or a lighter
    refresh) so new games/categories appear in the overview immediately.

## Relevant Files

- `routes/dashboard.js` — `GET /api/achievements-and-roles` handler (lines 56–73);
  add `achievements.games`.
- `roles/catalog.js` — `getAchievementsPage`, `getAchievementCategoryOrder`; add
  `getAchievementCategoryCounts` and possibly `getGamesWithCategories` wrapper.
- `roles/effectiveCatalog.js` — category cache (`loadCategoryNames`,
  `getCollectionCategoryNames`, `invalidateCategories`, lines 123–157); add a
  parallel cached games loader + `getGamesWithCategories()` + `invalidateGames()`.
- `mongo.js` — reuse `getAllGames` (302), `getAllCategories` (363); no schema
  change needed (categories already carry `gameId`).
- `routes/adminRoles.js` — call `invalidateGames()` after `insertGame` (329);
  category create already invalidates (373).
- `public/index.html` — insert `#games-overview` section (~after line 76); remove
  `#category-filter` block (82–92).
- `public/app.js` — `state` (4), `renderAchievements` (297),
  `populateCategoryFilter` (311, remove), `load` (321),
  category-filter listener (344, replace); add `renderGamesOverview`.

## Verification

- **Unit/spec**: run the jasmine suite with Node 18 (per memory
  `bongobot-node-toolchain`): `nvm use 18 && npm test`. Add a spec for
  `getGamesWithCategories()` grouping (matching gameId, "Ungrouped" bucket) and
  for `getAchievementCategoryCounts()` totals, following the style of
  `roles/catalogUtils.spec.js` / `roles/rolePosition.spec.js`.
- **API shape**: with the dev server up, `GET /api/achievements-and-roles` should
  return `achievements.games` = array of `{ id, name, slug, count, categories:
  [{ name, slug, count }] }`, and still return `achievements.categories` +
  `roles`.
- **Browser (preview_start name "bongobot", port 3000)**: log in via the admin
  gate, confirm the Games overview cards render above the table with correct
  counts; selecting a category in one card filters the table and resets other
  cards; selecting "All <game> categories" filters to the whole game; "Show all"
  clears; add a game/category via the drawers and confirm the overview updates.
  Check dark mode + mobile (`resize_window`) since the table already had a mobile
  overflow fix (commit c4fc0e5).

## Decisions

- **Scope = achievements table.** Only `type: 'achievement'` roles carry a
  `category`; professions/crafting have `category: null` and are not in this
  table. Games group categories, categories apply to achievements — so "roles
  table filterable by game" = the Achievements table.
- **Per-card category dropdown** (from your answer): each game card owns a
  category `<select>` scoped to that game; there is no separate global category
  dropdown anymore.
- **Single active filter** across all cards (selecting in one resets the others),
  plus a global clear. This avoids ambiguous multi-game selection.
- **Server-computed counts** (not client-derived) so they stay correct beyond one
  page of achievements.
- **Backward-compatible response**: keep `achievements.categories` so the
  add-role drawer and sort order keep working unchanged.

## Further Considerations

- **Counts vs. "empty" categories**: a category with zero achievements still
  appears in a card (count 0). Recommend showing it (admins want to see empty
  categories they created). Confirm if you'd rather hide zero-count categories.
- **"Ungrouped" bucket**: categories whose `gameId` matches no game. Recommend
  rendering an "Ungrouped" pseudo-card only when non-empty. Same for
  achievements whose `category` isn't in any game (shown when "Show all").
- **Clickable card header vs dropdown-only**: your answer specifies the scoped
  dropdown as the filter control. I'll make the card header/count non-interactive
  and rely on the dropdown's "All <game> categories" option for whole-game
  filtering. Say if you'd also like clicking the card title to select the game.
- **New public endpoint vs embedding**: I recommend embedding `games` in the
  existing dashboard response (one round-trip, counts consistent with items). A
  standalone `GET /api/games` (public) is an alternative if you foresee other
  consumers — easy to add later from the same helper.
