# Server-side filtered pagination for the Achievements table

## TL;DR

The dashboard fetches only page 1 of achievements (`pageSize=50`, server caps
`MAX_PAGE_SIZE=50`) and filters client-side over just that page, while the Games
overview card badges show **server-total** counts. Once total achievements exceed
50, a badge promises more rows than the table can show, and filtered views miss
matches beyond the first page. (See `plan-completion-report.md` §1.)

Fix by making the filter and pagination **server-side**: `GET
/api/achievements-and-roles` accepts `gameId`/`category`/`page`, filters the full
achievement-def set, returns that page plus filtered `pagination` meta, and the
client renders Prev/Next controls that refetch on filter/page change. Card badge
counts stay computed over all defs (unchanged). This scales to any dataset.

## Decisions

- **Server-side filtered pages** (chosen approach). Each filter or page change is
  one round-trip; the client never holds the whole catalog.
- **Card badge counts stay unfiltered.** The Games overview reflects the full
  catalog regardless of the active filter, so `achievements.games` keeps being
  computed over all defs every request.
- **`pagination.total` becomes the FILTERED total** (drives "Page X of Y" and
  Prev/Next bounds). The top summary stat (`#stat-achievements`) must keep showing
  the **grand** total, so the response also returns an unfiltered total
  (`achievements.totalAchievements`) — do not repoint the stat at the filtered
  `pagination.total`.
- **Ungrouped filtering** uses a shared sentinel token `__ungrouped__` (already
  used client-side) sent as `gameId`; the server maps it to the games entry whose
  `id` is `null`.
- **Filtering moves out of the client.** `renderAchievements()` no longer filters
  `state.items`; the server already returns the correct page. The client keeps the
  category-order sort for the current page.

## Steps

### Phase 1 — Backend: accept filter params and paginate the filtered set

1. **Add a filtered page helper** in `roles/catalog.js`. Extend
   `getAchievementsPage(page, pageSize, options)` (`roles/catalog.js:17`) to accept
   an optional `options = { categoryNames }` where `categoryNames` is a `Set`/array
   of allowed category names (or `null`/omitted for no filter):
   - Load `getAchievementDefs()` as today.
   - If `categoryNames` is provided, filter `all` to defs whose `def.category` is in
     the set **before** computing `total`/`totalPages`/`slice`, so `pagination`
     reflects the filtered result.
   - Keep the existing clamp-and-slice logic and return shape
     `{ items, pagination: { page, pageSize, total, totalPages } }` (now filtered).
   - Keep the call backward compatible: no `options` → current behavior.

2. **Resolve `gameId`/`category` → allowed category names** in the dashboard route.
   Add a small pure helper (in `roles/catalogUtils.js`, unit-testable, no DB) —
   `resolveFilterCategoryNames(games, { gameId, category })`:
   - If `category` is a non-empty string → return `[category]` (direct filter).
   - Else if `gameId` is provided (a real id string, or the `__ungrouped__`
     sentinel → match the entry with `id === null`) → find that entry in the
     `games` array (the output of `buildGamesWithCategories`) and return its
     `categories.map(c => c.name)`. Unknown `gameId` → return `[]` (empty result,
     not "all").
   - Else → return `null` (no filter).
   - Export the shared sentinel constant `UNGROUPED_FILTER_ID = '__ungrouped__'`
     from `catalogUtils.js` so the route reuses it.

3. **Wire the route** in `routes/dashboard.js` (`GET /api/achievements-and-roles`,
   `routes/dashboard.js:57`):
   - Parse `req.query.gameId` (string) and `req.query.category` (string) in
     addition to `page`/`pageSize`.
   - Compute `categoryCounts` and `achievements.games = await
     getGamesWithCategories(categoryCounts)` **first** (unchanged, unfiltered).
   - Derive `const categoryNames = resolveFilterCategoryNames(achievements.games,
     { gameId, category })` and call `getAchievementsPage(page, pageSize,
     { categoryNames })`.
   - Add `achievements.totalAchievements` = the unfiltered grand total. Get it
     without a second full scan where possible: reuse the count already available
     (e.g. sum of `categoryCounts`, or read `all.length` — if summing counts, note
     it excludes null-category defs, which is acceptable for this table since only
     `type:'achievement'` rows appear; prefer an explicit unfiltered total to avoid
     that subtlety — a `getAchievementsTotal()` in `catalog.js` returning
     `(await getAchievementDefs()).length` is fine).
   - Keep `achievements.categories` (flat order) and the `roles` mapping unchanged.

### Phase 2 — Frontend markup: pagination controls

4. **Add a pagination footer** to the Achievements card in `public/index.html`
   (inside `#achievements-section`, below the table wrapper ~`public/index.html:128`).
   Mirror existing styling. Include:
   - A results/status line: `#achievements-page-status` ("Page X of Y · N results"
     or similar), hidden when there are 0 results.
   - `#achievements-prev` and `#achievements-next` buttons (reuse the
     `#clear-filter` button classes), each `disabled` at the range bounds.
   - Wrap in a container that is hidden while loading/empty (follow the existing
     `-loading`/`-empty`/`data` state toggling used by `showAchievementsState`).

### Phase 3 — Frontend logic: fetch-driven filter + paging

5. **Extend `state`** in `public/app.js` (`public/app.js:4`): add `state.page = 1`
   and `state.pagination = null` (holds the server's `{ page, pageSize, total,
   totalPages }`). Keep `activeFilter` and `categoryToGameId`. `state.items` now
   holds only the current server page.

6. **Build the fetch query from the active filter** in `load()`
   (`public/app.js:475`):
   - Construct params: always `page=state.page` and `pageSize=PAGE_SIZE`; if
     `activeFilter.category` → add `category=`; else if `activeFilter.gameId` →
     add `gameId=` (send the sentinel `__ungrouped__` for the Ungrouped card as-is).
   - Read `totalAchievements` for the `#stat-achievements` tile (grand total), and
     `pagination` for the controls. Set `state.pagination = pagination`.
   - Re-render the games overview only on a full/first load or after a create — not
     on pure page navigation — to avoid rebuilding the card `<select>`s (and the
     resulting flicker). Split into `load()` (fetch + table + pagination, optional
     `{ rerenderGames }`) or gate `renderGamesOverview()` behind a flag. On page-nav
     loads, still call `reflectFilterSelection()` so selects keep their state.

7. **Simplify `renderAchievements()`** (`public/app.js:310`): drop the client-side
   `activeFilter` filtering (server did it). Sort `state.items` by
   `state.categoryOrder` and render. Update the pagination footer from
   `state.pagination`: set the status text, toggle Prev/Next `disabled` at bounds,
   and hide the footer when `total === 0`. Keep the `#clear-filter` visibility rule
   (visible when a filter is active).

8. **Reset to page 1 on filter change.** In the card `<select>` change handler
   (`public/app.js:429`) and `clearFilter()` (`public/app.js:469`): after updating
   `state.activeFilter`, set `state.page = 1`, then call `load()` (a fetch) instead
   of the current client-side `renderAchievements()`. `reflectFilterSelection()`
   still runs to keep the single-active-filter behavior across cards.

9. **Wire Prev/Next.** Add listeners: Prev → `state.page = Math.max(1,
   state.page - 1)`; Next → `state.page = Math.min(totalPages, state.page + 1)`;
   both then `load()` (page-nav mode, no games re-render). Guard against acting past
   bounds.

10. **Preserve grand-total stat.** Point `#stat-achievements` at
    `achievements.totalAchievements`, not `pagination.total`, so the tile stays
    constant while filtering.

## Relevant Files

- `roles/catalog.js` — `getAchievementsPage` (17): add `options.categoryNames`
  filtering; add `getAchievementsTotal()` (or equivalent unfiltered total).
- `roles/catalogUtils.js` — add pure `resolveFilterCategoryNames(games, filter)` +
  `UNGROUPED_FILTER_ID` sentinel export.
- `routes/dashboard.js` — parse `gameId`/`category`; resolve category names; pass to
  `getAchievementsPage`; add `achievements.totalAchievements` (57–78).
- `public/index.html` — pagination footer in `#achievements-section` (~after 128).
- `public/app.js` — `state` (4), `load` (475), `renderAchievements` (310), card
  `<select>` handler (429), `clearFilter` (469); add Prev/Next listeners and status
  updates.

## Verification

- **Unit/spec** (jasmine, Node 18 — `nvm use 18 && npm test`): add cases for
  `resolveFilterCategoryNames` (category direct, real gameId → its category names,
  `__ungrouped__` → null-id entry's categories, unknown gameId → `[]`, no filter →
  `null`) and for `getAchievementsPage` with `categoryNames` (filtered `total`,
  `totalPages`, clamped `page`, and correct `items` slice). Follow
  `roles/catalogUtils.spec.js` / `roles/gamesCatalog.spec.js` style. Keep the full
  suite green.
- **API shape**: with the dev server up (`preview_start` name "bongobot", port
  3000): `GET /api/achievements-and-roles?category=<name>&page=2` returns a filtered
  `pagination` (`total` = matches for that category) and a page-2 slice;
  `?gameId=<id>` filters to that game's categories; `?gameId=__ungrouped__` filters
  to ungrouped; `achievements.totalAchievements` stays constant across filters; card
  counts unchanged.
- **Browser**: log in via the admin gate; confirm Prev/Next paginate, "Page X of Y"
  is accurate, controls disable at bounds; selecting a category/game filters and
  resets to page 1; "Show all" clears back to the full paged list; the summary stat
  tile does not change when filtering. Seed or confirm >50 achievements so paging is
  exercised. Check dark mode + mobile (`resize_window`), given the prior
  mobile-overflow fix (c4fc0e5).

## Further Considerations

- **Skipping the games recompute per page**: an optional `?includeGames=0` param (or
  server-side memo) could avoid recomputing `achievements.games` + counts on pure
  page navigation. Not required; the counts are cheap and cached, but noted if the
  extra work shows up under load.
- **Empty filtered result**: a category/game with 0 achievements should show the
  existing achievements empty-state and hide the pagination footer (total 0), not an
  error.
- **Page bounds after filter shrink**: the server already clamps `page` to
  `totalPages`; the client should adopt the server's returned `pagination.page`
  rather than trusting its local `state.page`, so a stale high page number snaps back
  cleanly.
