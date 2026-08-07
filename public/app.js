(function () {
  const PAGE_SIZE = 50;

  const state = {
    items: [],
    categoryOrder: [],
    selectedCategory: '',
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

    categoryFilter: document.getElementById('category-filter'),

    achievementsLoading: document.getElementById('achievements-loading'),
    achievementsError: document.getElementById('achievements-error'),
    achievementsEmpty: document.getElementById('achievements-empty'),
    achievementsTableWrapper: document.getElementById('achievements-table-wrapper'),
    achievementsTableBody: document.getElementById('achievements-table-body'),

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
    const filtered = state.selectedCategory
      ? state.items.filter((item) => item.category === state.selectedCategory)
      : state.items;
    const sorted = sortByCategory(filtered, state.categoryOrder);

    if (sorted.length === 0) {
      showAchievementsState('empty');
      return;
    }
    els.achievementsTableBody.replaceChildren(...sorted.map(renderAchievementRow));
    showAchievementsState('data');
  }

  function populateCategoryFilter(categoryOrder) {
    const options = categoryOrder.map((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      return option;
    });
    els.categoryFilter.append(...options);
  }

  async function load() {
    showAchievementsState('loading');
    try {
      const res = await fetch(`/api/achievements-and-roles?page=1&pageSize=${PAGE_SIZE}`);
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const data = await res.json();
      const { items, pagination, categories } = data.achievements;

      els.statAchievements.textContent = String(pagination.total);
      state.items = items;
      state.categoryOrder = categories || [];
      populateCategoryFilter(state.categoryOrder);
      populateRoleCategorySelect(state.categoryOrder);
      renderAchievements();
    } catch (err) {
      console.error('Failed to load achievements and roles', err);
      els.achievementsError.textContent = 'Failed to load achievements. Please try again later.';
      showAchievementsState('error');
    }
  }

  els.categoryFilter.addEventListener('change', () => {
    state.selectedCategory = els.categoryFilter.value;
    renderAchievements();
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
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !els.drawer.classList.contains('hidden')) {
      closeDrawer();
    }
  });

  initAuth();
})();
