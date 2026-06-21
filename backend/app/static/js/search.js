import { state, api } from './app.js';
import { getSearchCenter, drawRadius, renderMarkers, clearMap } from './map.js';
import { renderResults, sortResults, setSheetState, toast, t, catName } from './ui.js';

let activeIndex = -1;

export function initSearch() {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  const dropdown = document.getElementById('autocomplete');

  input.addEventListener('input', () => {
    clearBtn.hidden = input.value === '';
    showSuggestions(input.value);
  });

  input.addEventListener('focus', () => showSuggestions(input.value));

  input.addEventListener('keydown', (event) => {
    const items = dropdown.querySelectorAll('.autocomplete-item');
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!items.length) return;
      activeIndex = event.key === 'ArrowDown'
        ? (activeIndex + 1) % items.length
        : (activeIndex - 1 + items.length) % items.length;
      items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0 && items[activeIndex]) {
        items[activeIndex].click();
      } else {
        const matches = matchCategories(input.value);
        if (matches.length) selectCategory(matches[0]);
      }
    } else if (event.key === 'Escape') {
      hideSuggestions();
    }
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.hidden = true;
    hideSuggestions();
    clearMap();
    state.results = [];
    renderResults();
    setSheetState('collapsed');
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.search-box')) hideSuggestions();
  });
}

function matchCategories(query) {
  const q = query.trim().toLowerCase();
  if (!q) return state.categories;
  return state.categories.filter((c) =>
    c.key.includes(q)
    || Object.values(c.names).some((name) => name.toLowerCase().includes(q)));
}

function showSuggestions(query) {
  const dropdown = document.getElementById('autocomplete');
  const matches = matchCategories(query);
  activeIndex = -1;
  dropdown.innerHTML = '';

  if (!matches.length) { dropdown.hidden = true; return; }

  for (const category of matches) {
    const btn = document.createElement('button');
    btn.className = 'autocomplete-item';
    btn.innerHTML = `<span>${category.icon}</span><span>${catName(category.key)}</span>`;
    btn.addEventListener('click', () => selectCategory(category));
    dropdown.appendChild(btn);
  }
  dropdown.hidden = false;
}

function hideSuggestions() {
  document.getElementById('autocomplete').hidden = true;
  activeIndex = -1;
}

function selectCategory(category) {
  const input = document.getElementById('search-input');
  input.value = catName(category.key);
  document.getElementById('search-clear').hidden = false;
  hideSuggestions();
  performSearch(category.key);
}

export async function performSearch(categoryKey, options = {}) {
  const center = options.center || getSearchCenter();
  const radius = options.radius || state.settings.default_radius;

  toast(t('searching'));
  const params = new URLSearchParams({
    lat: center.lat.toFixed(6),
    lng: center.lng.toFixed(6),
    radius: String(radius),
    category: categoryKey,
    sort: state.sort,
  });

  try {
    const data = await api(`/services/search?${params}`);
    state.results = data.results;
    state.lastSearch = { category: categoryKey, ...center, radius };

    sortResults();
    drawRadius(center.lat, center.lng, radius);
    renderMarkers(state.results);
    renderResults();
    setSheetState('half');
    toast(`${t('results')}: ${data.count} ${t('places')}`);
  } catch (error) {
    toast(error.message || t('search_error'));
  }
}
