/**
 * ui.js — i18n, темы, панели, нижняя шторка, список результатов, toast.
 */
import { state, saveLocalSettings, api } from './app.js';
import { focusService } from './map.js';
import { toggleFavorite, isFavorite, syncSettings, clearHistory } from './auth.js';

/* ===================== i18n ===================== */

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
  },
  ru: {
    search_placeholder: 'Поиск: аптека, банк, кафе...',
    results: 'Результаты', sort_distance: 'по расстоянию', sort_open: 'по времени работы',
    open: 'Открыто', closed: 'Закрыто', no_data: 'Нет данных',
    settings: 'Настройки', radius: 'Радиус поиска', theme: 'Тема',
    light: 'Светлая', dark: 'Тёмная', language: 'Язык',
    clear_history: 'Очистить историю поисков',
    profile: 'Профиль', favorites: 'Избранное', history: 'История',
    login: 'Войти', register: 'Регистрация', logout: 'Выйти',
    email: 'Email', password: 'Пароль (мин. 6 символов)', username: 'Имя и фамилия',
    guest_hint: 'Войдите, чтобы сохранять избранные места и историю поисков.',
    no_results: 'Ничего не найдено. Попробуйте увеличить радиус поиска.',
    empty_favorites: 'Нет избранных мест.', empty_history: 'История пуста.',
    login_required: 'Войдите, чтобы добавить в избранное',
    added_favorite: 'Добавлено в избранное', removed_favorite: 'Удалено из избранного',
    history_cleared: 'История очищена',
    geolocation_denied: 'Нет доступа к геолокации — показан Люблин',
    backend_error: 'Нет соединения с сервером',
    search_error: 'Ошибка поиска', searching: 'Ищу...',
    logged_in: 'Вход выполнен', logged_out: 'Выход выполнен', registered: 'Аккаунт создан',
    places: 'мест',
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

/* ===================== Toast ===================== */

let toastTimer = null;

export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ===================== Форматирование ===================== */

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

/* ===================== Нижняя шторка ===================== */

const SHEET_STATES = ['collapsed', 'half', 'full'];

export function setSheetState(stateName) {
  const sheet = document.getElementById('sheet');
  SHEET_STATES.forEach((s) => sheet.classList.toggle(s, s === stateName));
}

function initSheet() {
  const sheet = document.getElementById('sheet');
  const handle = document.getElementById('sheet-handle');

  // клик по шапке: collapsed <-> half
  handle.addEventListener('click', () => {
    setSheetState(sheet.classList.contains('collapsed') ? 'half' : 'collapsed');
  });

  // перетаскивание (свайп) с привязкой к ближайшему состоянию
  let dragStartY = null;
  let startTop = null;

  handle.addEventListener('pointerdown', (event) => {
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

    if (Math.abs(moved) < 12) return; // это был клик — обработает обработчик клика
    const current = SHEET_STATES.find((s) => sheet.classList.contains(s)) || 'collapsed';
    const index = SHEET_STATES.indexOf(current);
    const next = moved < 0
      ? SHEET_STATES[Math.min(index + 1, 2)]   // свайп вверх — раскрыть
      : SHEET_STATES[Math.max(index - 1, 0)];  // свайп вниз — свернуть
    setSheetState(next);
  });
}

/* ===================== Список результатов ===================== */

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

/* ===================== Панели и оверлей ===================== */

export function openPanel(id) {
  closePanels();
  document.getElementById(id).classList.add('open');
  document.getElementById('overlay').hidden = false;
}

export function closePanels() {
  document.querySelectorAll('.panel.open').forEach((p) => p.classList.remove('open'));
  document.getElementById('overlay').hidden = true;
}

/* ===================== Настройки ===================== */

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

/* ===================== Инициализация ===================== */

export function initUI() {
  initSheet();
  initSettingsPanel();

  document.getElementById('btn-settings').addEventListener('click', () => openPanel('panel-settings'));
  document.getElementById('overlay').addEventListener('click', closePanels);
  document.querySelectorAll('.panel-close').forEach((b) => b.addEventListener('click', closePanels));

  document.getElementById('btn-sort').addEventListener('click', () => {
    state.sort = state.sort === 'distance' ? 'opening_hours' : 'distance';
    updateSortLabel();
    sortResults();
    renderResults();
  });
}
