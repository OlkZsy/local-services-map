/**
 * app.js — главный модуль: общее состояние, API-клиент, инициализация.
 */
import { initMap } from './map.js';
import { initSearch } from './search.js';
import { applyLanguage, applyTheme, initUI, toast, t } from './ui.js';
import { initAuth } from './auth.js';

export const state = {
  config: { maptiler_api_key: null, default_radius: 1000, default_center: { lat: 51.2465, lng: 22.5684 } },
  categories: [],
  settings: { default_radius: 1000, theme: 'light', language: 'pl' },
  token: localStorage.getItem('token'),
  user: null,
  userLocation: null,       // {lat, lng} из геолокации браузера
  results: [],
  lastSearch: null,         // {category, lat, lng, radius}
  sort: 'distance',         // 'distance' | 'opening_hours'
  favorites: new Set(),     // osm_id избранных
};

/** Запрос к бэкенду. Кидает Error с .status при не-2xx ответе. */
export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options = { ...options, body: JSON.stringify(options.body) };
  }
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

  const response = await fetch(`/api${path}`, { ...options, headers });
  if (!response.ok) {
    let detail = null;
    try { detail = (await response.json()).detail; } catch { /* не JSON */ }
    const error = new Error(typeof detail === 'string' ? detail : `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

export function saveLocalSettings() {
  localStorage.setItem('settings', JSON.stringify(state.settings));
}

async function init() {
  const saved = localStorage.getItem('settings');
  if (saved) {
    try { Object.assign(state.settings, JSON.parse(saved)); } catch { /* битый JSON */ }
  }

  try {
    const [config, categories] = await Promise.all([api('/config'), api('/categories')]);
    state.config = config;
    state.categories = categories.categories;
  } catch {
    toast(t('backend_error'));
  }

  applyTheme(state.settings.theme);
  initUI();
  initMap();
  initSearch();
  initAuth();
  applyLanguage(state.settings.language);

  if (window.lucide) window.lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', init);
