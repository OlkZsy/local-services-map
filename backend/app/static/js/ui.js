import { state, saveLocalSettings } from './app.js';
import { focusService } from './map.js';
import { toggleFavorite, isFavorite, syncSettings, clearHistory } from './auth.js';
import { performSearch } from './search.js';

const I18N = {
  pl: {
    search_placeholder: 'Szukaj: apteka, bank, kawiarnia...',
    results: 'Wyniki', sort_distance: 'wg odległości', sort_open: 'wg godzin otwarcia',
    open: 'Otwarte', closed: 'Zamknięte', no_data: 'Brak danych',
    settings: 'Ustawienia', radius: 'Radius wyszukiwania', theme: 'Motyw',
    light: 'Jasny', dark: 'Ciemny', language: 'Język',
    clear_history: 'Wyczyść historię wyszukiwań',
    profile: 'Profil', favorites: 'Ulubione', history: 'Historia',
    login: 'Zaloguj się', register: 'Zarejestruj się', logout: 'Wyloguj się',
    email: 'Email', password: 'Hasło (min. 6 znaków)', username: 'Imię i nazwisko',
    guest_hint: 'Zaloguj się, aby zapisywać ulubione miejsca i historię wyszukiwań.',
    no_results: 'Brak wyników. Spróbuj zwiększyć promień wyszukiwania.',
    empty_favorites: 'Brak ulubionych miejsc.', empty_history: 'Historia jest pusta.',
    login_required: 'Zaloguj się, aby dodać do ulubionych',
    added_favorite: 'Dodano do ulubionych', removed_favorite: 'Usunięto z ulubionych',
    history_cleared: 'Historia została wyczyszczona',
    geolocation_denied: 'Brak dostępu do lokalizacji — pokazuję Lublin',
    backend_error: 'Brak połączenia z serwerem',
    search_error: 'Błąd wyszukiwania', searching: 'Szukam...',
    logged_in: 'Zalogowano', logged_out: 'Wylogowano', registered: 'Konto utworzone',
    places: 'miejsc',
    directions: 'Trasa (Google Maps)', place_unavailable: 'Brak danych o tym miejscu',
  },
  en: {
    search_placeholder: 'Search: pharmacy, bank, cafe...',
    results: 'Results', sort_distance: 'by distance', sort_open: 'by opening hours',
    open: 'Open', closed: 'Closed', no_data: 'No data',
    settings: 'Settings', radius: 'Search radius', theme: 'Theme',
    light: 'Light', dark: 'Dark', language: 'Language',
    clear_history: 'Clear search history',
    profile: 'Profile', favorites: 'Favorites', history: 'History',
    login: 'Log in', register: 'Sign up', logout: 'Log out',
    email: 'Email', password: 'Password (min. 6 chars)', username: 'Full name',
    guest_hint: 'Log in to save favorite places and search history.',
    no_results: 'No results. Try increasing the search radius.',
    empty_favorites: 'No favorite places yet.', empty_history: 'History is empty.',
    login_required: 'Log in to add favorites',
    added_favorite: 'Added to favorites', removed_favorite: 'Removed from favorites',
    history_cleared: 'History cleared',
    geolocation_denied: 'Location access denied — showing Lublin',
    backend_error: 'Cannot reach the server',
    search_error: 'Search failed', searching: 'Searching...',
    logged_in: 'Logged in', logged_out: 'Logged out', registered: 'Account created',
    places: 'places',
    directions: 'Directions (Google Maps)', place_unavailable: 'No data for this place',
  },
};

export function t(key) {
  const lang = state.settings.language;
  return (I18N[lang] && I18N[lang][key]) || I18N.pl[key] || key;
}

export function catName(category) {
  const def = state.categories.find((c) => c.key === category);
  return def ? (def.names[state.settings.language] || def.names.pl) : category;
}

export function catIcon(category) {
  const def = state.categories.find((c) => c.key === category);
  return def ? def.icon : '📍';
}

export function applyLanguage(lang) {
  if (!I18N[lang]) lang = 'pl';
  state.settings.language = lang;
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('#lang-switch button').forEach((b) => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
  updateSortLabel();
  renderResults();
}

export function applyTheme(theme) {
  state.settings.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.querySelectorAll('#theme-switch button').forEach((b) => {
    b.classList.toggle('active', b.dataset.theme === theme);
  });
}

let toastTimer = null;

export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

export function formatDistance(meters) {
  if (meters == null) return '';
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

function statusHtml(isOpen) {
  if (isOpen === true) return `<span class="status-dot status-open">🟢 ${t('open')}</span>`;
  if (isOpen === false) return `<span class="status-dot status-closed">🔴 ${t('closed')}</span>`;
  return `<span class="status-dot status-unknown">⚪ ${t('no_data')}</span>`;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

const SHEET_STATES = ['collapsed', 'half', 'full'];

export function setSheetState(stateName) {
  const sheet = document.getElementById('sheet');
  SHEET_STATES.forEach((s) => sheet.classList.toggle(s, s === stateName));
  const sortBtn = document.getElementById('btn-sort');
  if (sortBtn) sortBtn.hidden = stateName === 'collapsed';
}

function initSheet() {
  const sheet = document.getElementById('sheet');
  const handle = document.getElementById('sheet-handle');
  document.getElementById('btn-sort').hidden = true;

  handle.addEventListener('click', (event) => {
    if (event.target.closest('#btn-sort')) return;
    setSheetState(sheet.classList.contains('collapsed') ? 'half' : 'collapsed');
  });

  let dragStartY = null;
  let startTop = null;

  handle.addEventListener('pointerdown', (event) => {
    if (event.target.closest('#btn-sort')) return;
    dragStartY = event.clientY;
    startTop = sheet.getBoundingClientRect().top;
    sheet.classList.add('dragging');
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener('pointermove', (event) => {
    if (dragStartY === null) return;
    const delta = event.clientY - dragStartY;
    const headerH = 56;
    const top = Math.max(headerH, startTop + delta);
    sheet.style.transform = `translateY(${top - headerH}px)`;
  });

  handle.addEventListener('pointerup', (event) => {
    if (dragStartY === null) return;
    const moved = event.clientY - dragStartY;
    sheet.classList.remove('dragging');
    sheet.style.transform = '';
    dragStartY = null;

    if (Math.abs(moved) < 12) return; // короткое движение считаем кликом
    const current = SHEET_STATES.find((s) => sheet.classList.contains(s)) || 'collapsed';
    const index = SHEET_STATES.indexOf(current);
    const next = moved < 0
      ? SHEET_STATES[Math.min(index + 1, 2)]
      : SHEET_STATES[Math.max(index - 1, 0)];
    setSheetState(next);
  });
}

function updateSortLabel() {
  const label = document.getElementById('sort-label');
  if (label) label.textContent = state.sort === 'distance' ? t('sort_distance') : t('sort_open');
}

export function sortResults() {
  const rank = { true: 0, null: 1, false: 2 };
  if (state.sort === 'opening_hours') {
    state.results.sort((a, b) =>
      rank[String(a.is_open)] - rank[String(b.is_open)] || (a.distance ?? 0) - (b.distance ?? 0));
  } else {
    state.results.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }
}

export function renderResults() {
  const list = document.getElementById('results-list');
  const count = document.getElementById('results-count');
  count.textContent = state.results.length;
  list.innerHTML = '';

  if (!state.results.length) {
    list.innerHTML = `<li class="empty-hint">${t('no_results')}</li>`;
    return;
  }

  for (const service of state.results) {
    const li = document.createElement('li');
    li.className = 'result-item';
    li.innerHTML = `
      <span class="result-icon">${catIcon(service.category)}</span>
      <div class="result-info">
        <div class="result-name">${escapeHtml(service.name)}</div>
        <div class="result-meta">
          <span>${escapeHtml(catName(service.category))}</span>
          <span>📏 ${formatDistance(service.distance)}</span>
          ${statusHtml(service.is_open)}
        </div>
      </div>
      <button class="fav-btn ${isFavorite(service.osm_id) ? 'active' : ''}" title="⭐">⭐</button>
    `;
    li.addEventListener('click', () => {
      setSheetState('collapsed');
      focusService(service.osm_id);
    });
    li.querySelector('.fav-btn').addEventListener('click', (event) => {
      event.stopPropagation();
      toggleFavorite(service);
    });
    list.appendChild(li);
  }
}

export function openPanel(id) {
  closePanels();
  document.getElementById(id).classList.add('open');
  document.getElementById('overlay').hidden = false;
}

export function closePanels() {
  document.querySelectorAll('.panel.open').forEach((p) => p.classList.remove('open'));
  document.getElementById('overlay').hidden = true;
}

function initSettingsPanel() {
  const slider = document.getElementById('radius-slider');
  const value = document.getElementById('radius-value');

  slider.value = state.settings.default_radius;
  value.textContent = `${(slider.value / 1000).toFixed(1)} km`;

  slider.addEventListener('input', () => {
    value.textContent = `${(slider.value / 1000).toFixed(1)} km`;
  });
  slider.addEventListener('change', () => {
    state.settings.default_radius = Number(slider.value);
    saveLocalSettings();
    syncSettings();
    if (state.lastSearch) {
      performSearch(state.lastSearch.category, {
        center: { lat: state.lastSearch.lat, lng: state.lastSearch.lng },
        radius: state.settings.default_radius,
      });
    }
  });

  document.getElementById('theme-switch').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-theme]');
    if (!btn) return;
    applyTheme(btn.dataset.theme);
    saveLocalSettings();
    syncSettings();
  });

  document.getElementById('lang-switch').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-lang]');
    if (!btn) return;
    applyLanguage(btn.dataset.lang);
    saveLocalSettings();
    syncSettings();
  });

  document.getElementById('btn-clear-history').addEventListener('click', clearHistory);
}

export function initUI() {
  initSheet();
  initSettingsPanel();

  document.getElementById('btn-settings').addEventListener('click', () => openPanel('panel-settings'));
  document.getElementById('overlay').addEventListener('click', closePanels);
  document.querySelectorAll('.panel-close').forEach((b) => b.addEventListener('click', closePanels));

  document.getElementById('btn-sort').addEventListener('click', (event) => {
    event.stopPropagation(); // не передаём клик шторке, иначе она свернётся
    state.sort = state.sort === 'distance' ? 'opening_hours' : 'distance';
    updateSortLabel();
    sortResults();
    renderResults();
  });
}
