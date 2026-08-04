(function () {
  const PAGE_SIZE = 50;

  const state = {
    items: [],
    categoryOrder: [],
    selectedCategory: '',
  };

  const els = {
    statAchievements: document.getElementById('stat-achievements'),

    categoryFilter: document.getElementById('category-filter'),

    achievementsLoading: document.getElementById('achievements-loading'),
    achievementsError: document.getElementById('achievements-error'),
    achievementsEmpty: document.getElementById('achievements-empty'),
    achievementsTableWrapper: document.getElementById('achievements-table-wrapper'),
    achievementsTableBody: document.getElementById('achievements-table-body'),
  };

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

  load();
})();
