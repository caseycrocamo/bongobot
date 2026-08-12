(function () {
  const PAGE_SIZE = 50;

  const state = {
    items: [],
    categoryOrder: [],
    games: [],
    // Multi-select game filter: the set of toggled-on pill ids (a game's id, or
    // the Ungrouped sentinel). All games are selected on load.
    selectedGameIds: new Set(),
    // Single category filter chosen from the dropdown; null = all categories
    // within the selected games.
    selectedCategory: null,
    // Current 1-based page requested; snapped to the server's returned page.
    page: 1,
    // Server pagination meta for the current (filtered) result:
    // { page, pageSize, total, totalPages }.
    pagination: null,
  };

  // Admin auth is stored in localStorage with a 15-day expiry. Within that
  // window the user is not asked for the secret again.
  const AUTH_KEY = 'bongobot_admin_auth';
  const AUTH_TTL_MS = 15 * 24 * 60 * 60 * 1000; // 15 days

  const els = {
    // Login gate
    loginScreen: document.getElementById('login-screen'),
    loginForm: document.getElementById('login-form'),
    loginSecret: document.getElementById('login-secret'),
    loginError: document.getElementById('login-error'),
    loginSubmit: document.getElementById('login-submit'),
    appShell: document.getElementById('app-shell'),

    statAchievements: document.getElementById('stat-achievements'),
    statGames: document.getElementById('stat-games'),
    statCategories: document.getElementById('stat-categories'),

    // Games overview
    gamesOverviewLoading: document.getElementById('games-overview-loading'),
    gamesOverviewError: document.getElementById('games-overview-error'),
    gamesOverviewEmpty: document.getElementById('games-overview-empty'),
    gamesOverviewContent: document.getElementById('games-overview-content'),
    gamesPills: document.getElementById('games-pills'),
    categoryFilter: document.getElementById('category-filter'),

    clearFilter: document.getElementById('clear-filter'),

    achievementsLoading: document.getElementById('achievements-loading'),
    achievementsError: document.getElementById('achievements-error'),
    achievementsEmpty: document.getElementById('achievements-empty'),
    achievementsTableWrapper: document.getElementById('achievements-table-wrapper'),
    achievementsTableBody: document.getElementById('achievements-table-body'),
    achievementsPagination: document.getElementById('achievements-pagination'),
    achievementsPageStatus: document.getElementById('achievements-page-status'),
    achievementsPrev: document.getElementById('achievements-prev'),
    achievementsNext: document.getElementById('achievements-next'),

    // Drawer
    addRoleButton: document.getElementById('add-role-button'),
    drawer: document.getElementById('role-drawer'),
    drawerBackdrop: document.getElementById('role-drawer-backdrop'),
    drawerPanel: document.getElementById('role-drawer-panel'),
    drawerClose: document.getElementById('role-drawer-close'),

    alert: document.getElementById('role-alert'),
    alertMessage: document.getElementById('role-alert-message'),
    alertDismiss: document.getElementById('role-alert-dismiss'),

    form: document.getElementById('role-form'),
    type: document.getElementById('role-type'),
    shortName: document.getElementById('role-short-name'),
    shortNameError: document.getElementById('role-short-name-error'),
    descriptionField: document.getElementById('role-description-field'),
    description: document.getElementById('role-description'),
    descriptionError: document.getElementById('role-description-error'),
    categoryField: document.getElementById('role-category-field'),
    category: document.getElementById('role-category'),
    categoryError: document.getElementById('role-category-error'),
    color: document.getElementById('role-color'),
    colorValue: document.getElementById('role-color-value'),
    mentionable: document.getElementById('role-mentionable'),
    iconField: document.getElementById('role-icon-field'),
    iconNone: document.getElementById('role-icon-none'),
    iconUpload: document.getElementById('role-icon-upload'),
    iconUrlOpt: document.getElementById('role-icon-urlopt'),
    iconFileControl: document.getElementById('role-icon-file-control'),
    iconFile: document.getElementById('role-icon-file'),
    iconFileError: document.getElementById('role-icon-file-error'),
    iconUrlControl: document.getElementById('role-icon-url-control'),
    iconUrl: document.getElementById('role-icon-url'),
    iconUrlError: document.getElementById('role-icon-url-error'),

    cancel: document.getElementById('role-cancel'),
    save: document.getElementById('role-save'),

    toast: document.getElementById('role-toast'),
    toastMessage: document.getElementById('role-toast-message'),

    // Add game drawer
    addGameButton: document.getElementById('add-game-button'),
    gameDrawer: document.getElementById('game-drawer'),
    gameDrawerBackdrop: document.getElementById('game-drawer-backdrop'),
    gameDrawerPanel: document.getElementById('game-drawer-panel'),
    gameDrawerClose: document.getElementById('game-drawer-close'),
    gameAlert: document.getElementById('game-alert'),
    gameAlertMessage: document.getElementById('game-alert-message'),
    gameAlertDismiss: document.getElementById('game-alert-dismiss'),
    gameForm: document.getElementById('game-form'),
    gameName: document.getElementById('game-name'),
    gameNameError: document.getElementById('game-name-error'),
    gameCancel: document.getElementById('game-cancel'),
    gameSave: document.getElementById('game-save'),

    // Add category drawer
    addCategoryButton: document.getElementById('add-category-button'),
    categoryDrawer: document.getElementById('category-drawer'),
    categoryDrawerBackdrop: document.getElementById('category-drawer-backdrop'),
    categoryDrawerPanel: document.getElementById('category-drawer-panel'),
    categoryDrawerClose: document.getElementById('category-drawer-close'),
    categoryAlert: document.getElementById('category-alert'),
    categoryAlertMessage: document.getElementById('category-alert-message'),
    categoryAlertDismiss: document.getElementById('category-alert-dismiss'),
    categoryForm: document.getElementById('category-form'),
    categoryName: document.getElementById('category-name'),
    categoryNameError: document.getElementById('category-name-error'),
    categoryGame: document.getElementById('category-game'),
    categoryGameError: document.getElementById('category-game-error'),
    categoryCancel: document.getElementById('category-cancel'),
    categorySave: document.getElementById('category-save'),
  };

  // ---------------------------------------------------------------------------
  // Auth (login gate + 15-day persistence)
  // ---------------------------------------------------------------------------

  function getStoredAuth() {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.secret !== 'string' || typeof parsed.expiresAt !== 'number') {
        return null;
      }
      if (Date.now() >= parsed.expiresAt) {
        localStorage.removeItem(AUTH_KEY);
        return null;
      }
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function storeAuth(secret) {
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify({ secret, expiresAt: Date.now() + AUTH_TTL_MS }));
    } catch (_) {
      // ignore storage failures (private mode, etc.)
    }
  }

  function clearAuth() {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch (_) {
      // ignore
    }
  }

  function getSecret() {
    const auth = getStoredAuth();
    return auth ? auth.secret : '';
  }

  function showLoginError(message) {
    if (message) {
      els.loginError.textContent = message;
      els.loginError.classList.remove('hidden');
    } else {
      els.loginError.textContent = '';
      els.loginError.classList.add('hidden');
    }
  }

  function revealApp() {
    els.loginScreen.classList.add('hidden');
    els.appShell.classList.remove('hidden');
  }

  function showLogin(message) {
    // Make sure the drawer is not left open behind the gate.
    els.drawer.classList.add('hidden');
    els.drawerPanel.classList.add('translate-x-full');
    els.appShell.classList.add('hidden');
    els.loginScreen.classList.remove('hidden');
    els.loginSecret.value = '';
    showLoginError(message || '');
    els.loginSecret.focus();
  }

  async function handleLogin(event) {
    event.preventDefault();
    showLoginError('');
    const secret = els.loginSecret.value;
    if (!secret) {
      showLoginError('Admin secret is required.');
      return;
    }
    els.loginSubmit.disabled = true;
    try {
      const res = await fetch('/api/admin/session', {
        headers: { 'x-admin-secret': secret },
      });
      if (res.ok) {
        storeAuth(secret);
        revealApp();
        await load();
      } else if (res.status === 401) {
        showLoginError('Incorrect admin secret.');
      } else {
        showLoginError(`Sign-in failed (status ${res.status}). Please try again.`);
      }
    } catch (err) {
      console.error('Login failed', err);
      showLoginError('Network error. Please try again.');
    } finally {
      els.loginSubmit.disabled = false;
    }
  }

  function initAuth() {
    // Within the 15-day window, don't prompt again.
    if (getStoredAuth()) {
      revealApp();
      load();
    } else {
      showLogin('');
    }
  }

  // ---------------------------------------------------------------------------
  // Dashboard rendering
  // ---------------------------------------------------------------------------

  function showAchievementsState(name) {
    els.achievementsLoading.classList.toggle('hidden', name !== 'loading');
    els.achievementsError.classList.toggle('hidden', name !== 'error');
    els.achievementsEmpty.classList.toggle('hidden', name !== 'empty');
    els.achievementsTableWrapper.classList.toggle('hidden', name !== 'data');
    // The pagination footer only accompanies the data state; renderAchievements
    // further hides it when the (filtered) result is empty.
    if (name !== 'data') {
      els.achievementsPagination.classList.add('hidden');
    }
  }

  // Sync the pagination footer (status line + Prev/Next) from state.pagination.
  function updatePagination() {
    const pagination = state.pagination;
    if (!pagination || pagination.total === 0) {
      els.achievementsPagination.classList.add('hidden');
      return;
    }
    const { page, total, totalPages } = pagination;
    els.achievementsPageStatus.textContent =
      `Page ${page} of ${totalPages} · ${total} result${total === 1 ? '' : 's'}`;
    els.achievementsPrev.disabled = page <= 1;
    els.achievementsNext.disabled = page >= totalPages;
    els.achievementsPagination.classList.remove('hidden');
  }

  function renderRolePill(discordRole) {
    if (!discordRole) {
      const span = document.createElement('span');
      span.className = 'text-sm text-gray-400 dark:text-gray-500';
      span.textContent = 'Not in server';
      return span;
    }
    const pill = document.createElement('span');
    pill.className = 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium';
    pill.style.backgroundColor = `${discordRole.color}22`;
    pill.style.color = discordRole.color;
    pill.textContent = discordRole.color;
    return pill;
  }

  function renderAchievementRow(item) {
    const tr = document.createElement('tr');
    tr.className = 'border-t border-gray-200 dark:border-white/10';

    const nameCell = document.createElement('td');
    nameCell.className = 'py-3 pr-3 pl-4 text-sm sm:pl-3';
    const flex = document.createElement('div');
    flex.className = 'flex items-center gap-x-3';

    const img = document.createElement('img');
    img.src = item.icon;
    img.alt = item.short_name;
    img.loading = 'lazy';
    img.className = 'size-8 shrink-0 rounded-md object-contain outline -outline-offset-1 outline-black/5 dark:outline-white/10';
    img.style.boxShadow = `inset 0 0 0 1.5px ${item.color}`;
    flex.appendChild(img);

    const textWrap = document.createElement('div');
    textWrap.className = 'min-w-0';
    const name = document.createElement('div');
    name.className = 'font-medium text-gray-900 dark:text-white';
    name.textContent = item.short_name;
    const desc = document.createElement('div');
    desc.className = 'text-gray-500 dark:text-gray-400';
    desc.textContent = item.description;
    textWrap.appendChild(name);
    textWrap.appendChild(desc);
    flex.appendChild(textWrap);

    nameCell.appendChild(flex);
    tr.appendChild(nameCell);

    const categoryCell = document.createElement('td');
    categoryCell.className = 'px-3 py-3 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400';
    categoryCell.textContent = item.category || 'Other';
    tr.appendChild(categoryCell);

    const roleCell = document.createElement('td');
    roleCell.className = 'px-3 py-3 text-sm whitespace-nowrap';
    roleCell.appendChild(renderRolePill(item.discordRole));
    tr.appendChild(roleCell);

    return tr;
  }

  function sortByCategory(items, categoryOrder) {
    const rank = new Map(categoryOrder.map((name, index) => [name, index]));
    return [...items].sort((a, b) => {
      const rankA = rank.has(a.category) ? rank.get(a.category) : categoryOrder.length;
      const rankB = rank.has(b.category) ? rank.get(b.category) : categoryOrder.length;
      return rankA - rankB;
    });
  }

  function renderAchievements() {
    // The server already returned the correct (filtered) page; just order the
    // current page by category and render.
    const sorted = sortByCategory(state.items, state.categoryOrder);

    // Reveal the global clear/reset control only while a filter is active.
    updateClearButton();

    if (sorted.length === 0) {
      showAchievementsState('empty');
      return;
    }
    els.achievementsTableBody.replaceChildren(...sorted.map(renderAchievementRow));
    showAchievementsState('data');
    updatePagination();
  }

  // ---------------------------------------------------------------------------
  // Games overview (toggleable game pills + a single scoped category dropdown)
  // ---------------------------------------------------------------------------

  // Sentinel filter id for the synthetic "Ungrouped" pill (game id is null in
  // the API), so it can be selected and sent to the server distinctly.
  const UNGROUPED_ID = '__ungrouped__';

  function showGamesOverviewState(name) {
    els.gamesOverviewLoading.classList.toggle('hidden', name !== 'loading');
    els.gamesOverviewError.classList.toggle('hidden', name !== 'error');
    els.gamesOverviewEmpty.classList.toggle('hidden', name !== 'empty');
    els.gamesOverviewContent.classList.toggle('hidden', name !== 'data');
  }

  // A pill's filter id: the real game id, or the sentinel for the Ungrouped pill.
  function cardFilterId(game) {
    return game.id === null ? UNGROUPED_ID : game.id;
  }

  // True when every available game pill is toggled on (or there are no games) —
  // i.e. no game-level narrowing is in effect.
  function allGamesSelected() {
    return state.games.length === 0 || state.selectedGameIds.size === state.games.length;
  }

  // categoryName -> count across all games (counts are game-independent).
  function buildCategoryCounts() {
    const counts = {};
    state.games.forEach((game) => {
      (game.categories || []).forEach((cat) => {
        counts[cat.name] = cat.count;
      });
    });
    return counts;
  }

  // Ordered, de-duplicated category names belonging to the currently selected
  // games, following the canonical category order.
  function selectedCategoryNames() {
    const inSelected = new Set();
    state.games.forEach((game) => {
      if (!state.selectedGameIds.has(cardFilterId(game))) return;
      (game.categories || []).forEach((cat) => inSelected.add(cat.name));
    });
    const ordered = state.categoryOrder.filter((name) => inSelected.has(name));
    // Defensive: include any selected-game category missing from categoryOrder.
    inSelected.forEach((name) => {
      if (!ordered.includes(name)) ordered.push(name);
    });
    return ordered;
  }

  const PILL_BASE =
    'inline-flex items-center gap-x-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-500';
  const PILL_ON = 'bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400';
  const PILL_OFF = 'bg-white text-gray-700 inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-gray-300 dark:inset-ring-white/10 dark:hover:bg-white/20';
  const PILL_COUNT_ON = 'rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-semibold';
  const PILL_COUNT_OFF = 'rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300';

  function stylePill(pill, on) {
    pill.className = `${PILL_BASE} ${on ? PILL_ON : PILL_OFF}`;
    pill.setAttribute('aria-pressed', on ? 'true' : 'false');
    const count = pill.querySelector('[data-count]');
    if (count) count.className = on ? PILL_COUNT_ON : PILL_COUNT_OFF;
  }

  // Minimal CSS.escape fallback for use in an attribute selector.
  function cssEscape(value) {
    return window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function renderGamePills() {
    els.gamesPills.replaceChildren(
      ...state.games.map((game) => {
        const gid = cardFilterId(game);
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.dataset.gameId = String(gid);

        const label = document.createElement('span');
        label.textContent = game.name;
        pill.appendChild(label);

        const count = document.createElement('span');
        count.dataset.count = '';
        count.textContent = String(game.count);
        pill.appendChild(count);

        stylePill(pill, state.selectedGameIds.has(gid));
        pill.addEventListener('click', () => togglePill(gid));
        return pill;
      })
    );
  }

  function togglePill(gid) {
    if (state.selectedGameIds.has(gid)) {
      state.selectedGameIds.delete(gid);
    } else {
      state.selectedGameIds.add(gid);
    }
    const pill = els.gamesPills.querySelector(`button[data-game-id="${cssEscape(String(gid))}"]`);
    if (pill) stylePill(pill, state.selectedGameIds.has(gid));

    // Rebuild the dropdown from the new selection (drops a chosen category whose
    // game was just toggled off), then refetch from page 1.
    renderCategoryDropdown();
    state.page = 1;
    load({ rerenderGames: false });
  }

  function renderCategoryDropdown() {
    const counts = buildCategoryCounts();
    const names = selectedCategoryNames();

    // Preserve the current selection only if it is still available.
    if (state.selectedCategory && !names.includes(state.selectedCategory)) {
      state.selectedCategory = null;
    }

    const all = document.createElement('option');
    all.value = '';
    all.textContent = 'All categories';
    const options = [all];
    names.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = `${name} (${counts[name] || 0})`;
      options.push(option);
    });
    els.categoryFilter.replaceChildren(...options);
    els.categoryFilter.value = state.selectedCategory || '';
  }

  function onCategoryChange() {
    state.selectedCategory = els.categoryFilter.value || null;
    state.page = 1;
    load({ rerenderGames: false });
  }

  function renderGamesOverview() {
    if (!state.games || state.games.length === 0) {
      els.gamesPills.replaceChildren();
      els.categoryFilter.replaceChildren();
      showGamesOverviewState('empty');
      return;
    }
    renderGamePills();
    renderCategoryDropdown();
    showGamesOverviewState('data');
  }

  // The clear/reset control is shown whenever the filter differs from the
  // default (all games on, all categories).
  function updateClearButton() {
    const active = !allGamesSelected() || Boolean(state.selectedCategory);
    els.clearFilter.classList.toggle('hidden', !active);
  }

  function resetFilters() {
    state.selectedGameIds = new Set(state.games.map(cardFilterId));
    state.selectedCategory = null;
    renderGamePills();
    renderCategoryDropdown();
    state.page = 1;
    load({ rerenderGames: false });
  }

  // Build the query string for the achievements fetch. A chosen category filters
  // directly; otherwise a non-"all" game selection sends the selected ids (the
  // Ungrouped sentinel included). All games + no category => no filter params.
  function buildAchievementsQuery() {
    const params = new URLSearchParams();
    params.set('page', String(state.page));
    params.set('pageSize', String(PAGE_SIZE));
    if (state.selectedCategory) {
      params.set('category', state.selectedCategory);
    } else if (!allGamesSelected()) {
      params.set('gameIds', [...state.selectedGameIds].join(','));
    }
    return params.toString();
  }

  // opts.rerenderGames: full/first load (or after a create) — reset the filter to
  // "all games, all categories", rebuild the pills + dropdown, and fetch the
  // unfiltered first page. Page navigation / filter changes pass false and keep
  // the current pills in place.
  async function load(opts = {}) {
    const { rerenderGames = true } = opts;
    showAchievementsState('loading');
    if (rerenderGames) {
      showGamesOverviewState('loading');
      state.page = 1;
      state.selectedCategory = null;
    }
    try {
      // A full load does not yet know the game list, so it fetches unfiltered
      // (all achievements); non-full loads apply the current filter.
      const query = rerenderGames
        ? new URLSearchParams({ page: '1', pageSize: String(PAGE_SIZE) }).toString()
        : buildAchievementsQuery();
      const res = await fetch(`/api/achievements-and-roles?${query}`);
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const data = await res.json();
      const { items, pagination, categories, games, totalAchievements } = data.achievements;

      // Summary stat tiles show the unfiltered totals, so they stay constant
      // while the table is filtered.
      els.statAchievements.textContent = String(totalAchievements);
      els.statGames.textContent = String((games || []).filter((g) => g.id !== null).length);
      els.statCategories.textContent = String((categories || []).length);

      state.items = items;
      state.categoryOrder = categories || [];
      state.pagination = pagination;
      // Adopt the server's clamped page so a stale high page number snaps back.
      state.page = pagination.page;
      if (rerenderGames) {
        state.games = games || [];
        // Default to every game selected.
        state.selectedGameIds = new Set(state.games.map(cardFilterId));
        renderGamesOverview();
      }
      populateRoleCategorySelect(state.categoryOrder);
      renderAchievements();
    } catch (err) {
      console.error('Failed to load achievements and roles', err);
      els.achievementsError.textContent = 'Failed to load achievements. Please try again later.';
      showAchievementsState('error');
      if (rerenderGames) {
        els.gamesOverviewError.textContent = 'Failed to load games.';
        showGamesOverviewState('error');
      }
    }
  }

  els.categoryFilter.addEventListener('change', onCategoryChange);
  els.clearFilter.addEventListener('click', resetFilters);

  // Prev/Next paginate within the current filter without rebuilding the games
  // overview. Guard against stepping past the known bounds.
  els.achievementsPrev.addEventListener('click', () => {
    if (state.page <= 1) return;
    state.page = Math.max(1, state.page - 1);
    load({ rerenderGames: false });
  });
  els.achievementsNext.addEventListener('click', () => {
    const totalPages = state.pagination ? state.pagination.totalPages : 1;
    if (state.page >= totalPages) return;
    state.page = Math.min(totalPages, state.page + 1);
    load({ rerenderGames: false });
  });

  // ---------------------------------------------------------------------------
  // Add role drawer
  // ---------------------------------------------------------------------------

  function populateRoleCategorySelect(categoryOrder) {
    const current = els.category.value;
    // Keep the leading placeholder option, drop the rest.
    while (els.category.options.length > 1) {
      els.category.remove(1);
    }
    els.category.append(
      ...categoryOrder.map((name) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        return option;
      })
    );
    if (current) {
      els.category.value = current;
    }
  }

  function showFieldError(errorEl, message) {
    if (message) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    } else {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }
  }

  function clearFieldErrors() {
    [
      els.shortNameError,
      els.descriptionError,
      els.categoryError,
      els.iconFileError,
      els.iconUrlError,
    ].forEach((el) => showFieldError(el, ''));
  }

  function showAlert(message) {
    els.alertMessage.textContent = message;
    els.alert.classList.remove('hidden');
  }

  function hideAlert() {
    els.alert.classList.add('hidden');
    els.alertMessage.textContent = '';
  }

  function showToast(message) {
    els.toastMessage.textContent = message;
    els.toast.classList.remove('hidden');
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => {
      els.toast.classList.add('hidden');
    }, 5000);
  }

  function getIconSource() {
    const checked = els.form.querySelector('input[name="role-icon-source"]:checked');
    return checked ? checked.value : 'none';
  }

  function applyTypeVisibility() {
    const type = els.type.value;
    // Description: achievement & crafting.
    els.descriptionField.classList.toggle('hidden', type === 'profession');
    // Category: achievement only.
    els.categoryField.classList.toggle('hidden', type !== 'achievement');
    // Icon: achievement & crafting.
    els.iconField.classList.toggle('hidden', type === 'profession');
  }

  function applyIconSourceVisibility() {
    const source = getIconSource();
    els.iconFileControl.classList.toggle('hidden', source !== 'upload');
    els.iconUrlControl.classList.toggle('hidden', source !== 'url');
  }

  function openDrawer() {
    // Guard: if the session lapsed, send the user back to the login gate.
    if (!getSecret()) {
      showLogin('Your session has expired. Please sign in again.');
      return;
    }
    hideAlert();
    clearFieldErrors();
    applyTypeVisibility();
    applyIconSourceVisibility();
    els.drawer.classList.remove('hidden');
    // Next frame so the transition runs.
    requestAnimationFrame(() => {
      els.drawerPanel.classList.remove('translate-x-full');
    });
  }

  function closeDrawer() {
    els.drawerPanel.classList.add('translate-x-full');
    window.setTimeout(() => {
      els.drawer.classList.add('hidden');
    }, 300);
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  function validate() {
    clearFieldErrors();
    let valid = true;
    const type = els.type.value;

    const shortName = els.shortName.value.trim();
    if (shortName.length < 1 || shortName.length > 80) {
      showFieldError(els.shortNameError, 'Short name must be 1–80 characters.');
      valid = false;
    }

    if ((type === 'achievement' || type === 'crafting') && !els.description.value.trim()) {
      showFieldError(els.descriptionError, 'Description is required.');
      valid = false;
    }

    if (type === 'achievement' && !els.category.value) {
      showFieldError(els.categoryError, 'Category is required.');
      valid = false;
    }

    if (type !== 'profession') {
      const source = getIconSource();
      if (source === 'upload' && !(els.iconFile.files && els.iconFile.files[0])) {
        showFieldError(els.iconFileError, 'Please choose an image file.');
        valid = false;
      }
      if (source === 'url' && !els.iconUrl.value.trim()) {
        showFieldError(els.iconUrlError, 'Please enter an image URL.');
        valid = false;
      }
    }

    return valid;
  }

  async function submitRole(event) {
    event.preventDefault();
    hideAlert();
    if (!validate()) {
      return;
    }

    const secret = getSecret();
    if (!secret) {
      closeDrawer();
      showLogin('Your session has expired. Please sign in again.');
      return;
    }

    const type = els.type.value;
    const iconSource = type === 'profession' ? 'none' : getIconSource();

    const body = {
      type,
      short_name: els.shortName.value.trim(),
      description: type === 'profession' ? '' : els.description.value.trim(),
      category: type === 'achievement' ? els.category.value : '',
      color: els.color.value,
      mentionable: els.mentionable.checked,
      iconSource,
    };

    try {
      if (iconSource === 'upload' && els.iconFile.files[0]) {
        body.iconData = await readFileAsDataURL(els.iconFile.files[0]);
      } else if (iconSource === 'url') {
        body.iconUrl = els.iconUrl.value.trim();
      }
    } catch (err) {
      showAlert('Could not read the selected image file. Please try again.');
      return;
    }

    els.save.disabled = true;
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': secret,
        },
        body: JSON.stringify(body),
      });

      let data = {};
      try {
        data = await res.json();
      } catch (_) {
        // ignore non-JSON responses
      }

      if (res.status === 201) {
        closeDrawer();
        els.form.reset();
        els.colorValue.textContent = els.color.value;
        applyTypeVisibility();
        applyIconSourceVisibility();
        showToast(data.warning ? `Role created. Warning: ${data.warning}` : 'Role created successfully.');
        await load();
        return;
      }

      // Secret rotated or session no longer accepted: drop it and re-gate.
      if (res.status === 401) {
        clearAuth();
        closeDrawer();
        showLogin('Your session has expired or the secret changed. Please sign in again.');
        return;
      }

      showAlert((data && data.error) || `Request failed with status ${res.status}`);
    } catch (err) {
      console.error('Failed to create role', err);
      showAlert('Network error. Please try again.');
    } finally {
      els.save.disabled = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Add game drawer
  // ---------------------------------------------------------------------------

  function showGameAlert(message) {
    els.gameAlertMessage.textContent = message;
    els.gameAlert.classList.remove('hidden');
  }
  function hideGameAlert() {
    els.gameAlert.classList.add('hidden');
    els.gameAlertMessage.textContent = '';
  }

  function openGameDrawer() {
    if (!getSecret()) {
      showLogin('Your session has expired. Please sign in again.');
      return;
    }
    hideGameAlert();
    showFieldError(els.gameNameError, '');
    els.gameDrawer.classList.remove('hidden');
    requestAnimationFrame(() => {
      els.gameDrawerPanel.classList.remove('translate-x-full');
    });
  }
  function closeGameDrawer() {
    els.gameDrawerPanel.classList.add('translate-x-full');
    window.setTimeout(() => {
      els.gameDrawer.classList.add('hidden');
    }, 300);
  }

  async function submitGame(event) {
    event.preventDefault();
    hideGameAlert();
    showFieldError(els.gameNameError, '');

    const name = els.gameName.value.trim();
    if (name.length < 1 || name.length > 80) {
      showFieldError(els.gameNameError, 'Name must be 1–80 characters.');
      return;
    }

    const secret = getSecret();
    if (!secret) {
      closeGameDrawer();
      showLogin('Your session has expired. Please sign in again.');
      return;
    }

    els.gameSave.disabled = true;
    try {
      const res = await fetch('/api/admin/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ name }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch (_) {}

      if (res.status === 201) {
        closeGameDrawer();
        els.gameForm.reset();
        showToast('Game created successfully.');
        // Refresh so the new game appears in the overview immediately.
        await load();
        return;
      }
      if (res.status === 401) {
        clearAuth();
        closeGameDrawer();
        showLogin('Your session has expired or the secret changed. Please sign in again.');
        return;
      }
      showGameAlert((data && data.error) || `Request failed with status ${res.status}`);
    } catch (err) {
      console.error('Failed to create game', err);
      showGameAlert('Network error. Please try again.');
    } finally {
      els.gameSave.disabled = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Add category drawer
  // ---------------------------------------------------------------------------

  function showCategoryAlert(message) {
    els.categoryAlertMessage.textContent = message;
    els.categoryAlert.classList.remove('hidden');
  }
  function hideCategoryAlert() {
    els.categoryAlert.classList.add('hidden');
    els.categoryAlertMessage.textContent = '';
  }

  function populateCategoryGameSelect(games) {
    while (els.categoryGame.options.length > 1) {
      els.categoryGame.remove(1);
    }
    els.categoryGame.append(
      ...games.map((game) => {
        const option = document.createElement('option');
        option.value = game.id;
        option.textContent = game.name;
        return option;
      })
    );
  }

  async function loadGamesIntoCategorySelect() {
    const secret = getSecret();
    if (!secret) return;
    try {
      const res = await fetch('/api/admin/games', { headers: { 'x-admin-secret': secret } });
      if (res.status === 401) {
        clearAuth();
        closeCategoryDrawer();
        showLogin('Your session has expired or the secret changed. Please sign in again.');
        return;
      }
      if (!res.ok) {
        showCategoryAlert(`Failed to load games (status ${res.status}).`);
        return;
      }
      const data = await res.json();
      populateCategoryGameSelect(data.games || []);
      if (!data.games || data.games.length === 0) {
        showCategoryAlert('No games exist yet. Add a game first.');
      }
    } catch (err) {
      console.error('Failed to load games', err);
      showCategoryAlert('Network error loading games. Please try again.');
    }
  }

  function openCategoryDrawer() {
    if (!getSecret()) {
      showLogin('Your session has expired. Please sign in again.');
      return;
    }
    hideCategoryAlert();
    showFieldError(els.categoryNameError, '');
    showFieldError(els.categoryGameError, '');
    els.categoryDrawer.classList.remove('hidden');
    requestAnimationFrame(() => {
      els.categoryDrawerPanel.classList.remove('translate-x-full');
    });
    loadGamesIntoCategorySelect();
  }
  function closeCategoryDrawer() {
    els.categoryDrawerPanel.classList.add('translate-x-full');
    window.setTimeout(() => {
      els.categoryDrawer.classList.add('hidden');
    }, 300);
  }

  async function submitCategory(event) {
    event.preventDefault();
    hideCategoryAlert();
    showFieldError(els.categoryNameError, '');
    showFieldError(els.categoryGameError, '');

    let valid = true;
    const name = els.categoryName.value.trim();
    if (name.length < 1 || name.length > 80) {
      showFieldError(els.categoryNameError, 'Name must be 1–80 characters.');
      valid = false;
    }
    if (!els.categoryGame.value) {
      showFieldError(els.categoryGameError, 'Game is required.');
      valid = false;
    }
    if (!valid) return;

    const secret = getSecret();
    if (!secret) {
      closeCategoryDrawer();
      showLogin('Your session has expired. Please sign in again.');
      return;
    }

    els.categorySave.disabled = true;
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ name, gameId: els.categoryGame.value }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch (_) {}

      if (res.status === 201) {
        closeCategoryDrawer();
        els.categoryForm.reset();
        showToast('Category created successfully.');
        // Refresh so the new category is selectable in the add-role drawer
        // and appears in the dashboard filter.
        await load();
        return;
      }
      if (res.status === 401) {
        clearAuth();
        closeCategoryDrawer();
        showLogin('Your session has expired or the secret changed. Please sign in again.');
        return;
      }
      showCategoryAlert((data && data.error) || `Request failed with status ${res.status}`);
    } catch (err) {
      console.error('Failed to create category', err);
      showCategoryAlert('Network error. Please try again.');
    } finally {
      els.categorySave.disabled = false;
    }
  }

  els.loginForm.addEventListener('submit', handleLogin);
  els.addRoleButton.addEventListener('click', openDrawer);
  els.drawerClose.addEventListener('click', closeDrawer);
  els.cancel.addEventListener('click', closeDrawer);
  els.drawerBackdrop.addEventListener('click', closeDrawer);
  els.alertDismiss.addEventListener('click', hideAlert);
  els.type.addEventListener('change', applyTypeVisibility);
  els.color.addEventListener('input', () => {
    els.colorValue.textContent = els.color.value;
  });
  [els.iconNone, els.iconUpload, els.iconUrlOpt].forEach((radio) => {
    radio.addEventListener('change', applyIconSourceVisibility);
  });
  els.form.addEventListener('submit', submitRole);

  els.addGameButton.addEventListener('click', openGameDrawer);
  els.gameDrawerClose.addEventListener('click', closeGameDrawer);
  els.gameCancel.addEventListener('click', closeGameDrawer);
  els.gameDrawerBackdrop.addEventListener('click', closeGameDrawer);
  els.gameAlertDismiss.addEventListener('click', hideGameAlert);
  els.gameForm.addEventListener('submit', submitGame);

  els.addCategoryButton.addEventListener('click', openCategoryDrawer);
  els.categoryDrawerClose.addEventListener('click', closeCategoryDrawer);
  els.categoryCancel.addEventListener('click', closeCategoryDrawer);
  els.categoryDrawerBackdrop.addEventListener('click', closeCategoryDrawer);
  els.categoryAlertDismiss.addEventListener('click', hideCategoryAlert);
  els.categoryForm.addEventListener('submit', submitCategory);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!els.drawer.classList.contains('hidden')) {
      closeDrawer();
    } else if (!els.gameDrawer.classList.contains('hidden')) {
      closeGameDrawer();
    } else if (!els.categoryDrawer.classList.contains('hidden')) {
      closeCategoryDrawer();
    }
  });

  initAuth();
})();
