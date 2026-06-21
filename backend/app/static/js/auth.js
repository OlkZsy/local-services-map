import { state, api, saveLocalSettings } from './app.js';
import {
  t, toast, openPanel, closePanels, renderResults,
  applyTheme, applyLanguage, catIcon, catName, escapeHtml,
} from './ui.js';
import { showPlace, refreshMarkers } from './map.js';
import { performSearch } from './search.js';

export function isFavorite(osmId) {
  return state.favorites.has(osmId);
}

async function loadSession() {
  if (!state.token) return;
  try {
    state.user = await api('/auth/me');
    // настройки с сервера имеют приоритет над сохранёнными локально
    Object.assign(state.settings, state.user.settings);
    saveLocalSettings();
    applyTheme(state.settings.theme);
    applyLanguage(state.settings.language);
    document.getElementById('radius-slider').value = state.settings.default_radius;
    document.getElementById('radius-value').textContent =
      `${(state.settings.default_radius / 1000).toFixed(1)} km`;
    await loadFavorites();
  } catch {
    state.token = null;
    state.user = null;
    localStorage.removeItem('token');
  }
  renderProfile();
}

function setToken(token) {
  state.token = token;
  localStorage.setItem('token', token);
}

async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* токен мог истечь */ }
  state.token = null;
  state.user = null;
  state.favorites.clear();
  localStorage.removeItem('token');
  renderProfile();
  renderResults();
  refreshMarkers();
  closePanels();
  toast(t('logged_out'));
}

function renderProfile() {
  const guest = document.getElementById('profile-guest');
  const userBlock = document.getElementById('profile-user');
  if (state.user) {
    guest.hidden = true;
    userBlock.hidden = false;
    document.getElementById('profile-name').textContent = state.user.username;
    document.getElementById('profile-email').textContent = state.user.email;
  } else {
    guest.hidden = false;
    userBlock.hidden = true;
  }
}

async function loadFavorites() {
  const data = await api('/users/favorites');
  state.favorites = new Set(data.favorites.map((f) => f.service_osm_id));
  renderFavoritesList(data.favorites);
}

function renderFavoritesList(favorites) {
  const list = document.getElementById('favorites-list');
  list.innerHTML = '';
  if (!favorites.length) {
    list.innerHTML = `<li class="empty-hint">${t('empty_favorites')}</li>`;
    return;
  }
  for (const favorite of favorites) {
    const li = document.createElement('li');
    li.className = 'result-item';
    li.innerHTML = `
      <span class="result-icon">${catIcon(favorite.service_category)}</span>
      <div class="result-info">
        <div class="result-name">${escapeHtml(favorite.service_name)}</div>
        <div class="result-meta"><span>${escapeHtml(catName(favorite.service_category))}</span></div>
      </div>
      <button class="fav-btn active" title="✕">⭐</button>
    `;
    li.addEventListener('click', () => {
      closePanels();
      showPlace(favorite.service_osm_id, {
        osm_id: favorite.service_osm_id,
        name: favorite.service_name,
        category: favorite.service_category,
        lat: favorite.lat,
        lng: favorite.lng,
      });
    });
    li.querySelector('.fav-btn').addEventListener('click', async (event) => {
      event.stopPropagation();
      await removeFavorite(favorite.service_osm_id);
    });
    list.appendChild(li);
  }
}

export async function toggleFavorite(service) {
  if (!state.user) {
    toast(t('login_required'));
    openAuthModal('login');
    return;
  }
  try {
    if (state.favorites.has(service.osm_id)) {
      await removeFavorite(service.osm_id);
    } else {
      await api('/users/favorites', { method: 'POST', body: { osm_id: service.osm_id } });
      state.favorites.add(service.osm_id);
      toast(t('added_favorite'));
      await loadFavorites();
    }
    renderResults();
    refreshMarkers();
  } catch (error) {
    toast(error.message);
  }
}

async function removeFavorite(osmId) {
  await api(`/users/favorites/${encodeURIComponent(osmId)}`, { method: 'DELETE' });
  state.favorites.delete(osmId);
  toast(t('removed_favorite'));
  await loadFavorites();
  renderResults();
  refreshMarkers();
}

async function loadHistory() {
  const data = await api('/users/history');
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  if (!data.history.length) {
    list.innerHTML = `<li class="empty-hint">${t('empty_history')}</li>`;
    return;
  }
  for (const item of data.history) {
    const date = new Date(item.searched_at);
    const li = document.createElement('li');
    li.className = 'result-item';
    li.innerHTML = `
      <span class="result-icon">${catIcon(item.category)}</span>
      <div class="result-info">
        <div class="result-name">${escapeHtml(catName(item.category))}</div>
        <div class="result-meta">
          <span>${(item.radius / 1000).toFixed(1)} km · ${item.results_count} 📍</span>
          <span>${date.toLocaleDateString()} ${date.toLocaleTimeString().slice(0, 5)}</span>
        </div>
      </div>
    `;
    li.addEventListener('click', () => {
      closePanels();
      performSearch(item.category, {
        center: { lat: item.lat, lng: item.lng },
        radius: item.radius,
      });
    });
    list.appendChild(li);
  }
}

export async function clearHistory() {
  if (!state.user) { toast(t('login_required')); return; }
  try {
    await api('/users/history', { method: 'DELETE' });
    toast(t('history_cleared'));
    await loadHistory();
  } catch (error) {
    toast(error.message);
  }
}

export async function syncSettings() {
  if (!state.user) return;
  try {
    await api('/users/settings', {
      method: 'PATCH',
      body: {
        default_radius: state.settings.default_radius,
        theme: state.settings.theme,
        language: state.settings.language,
      },
    });
  } catch { /* не критично: настройки уже сохранены локально */ }
}

function openAuthModal(mode) {
  closePanels();
  document.getElementById('modal-auth').hidden = false;
  switchAuthTab(mode);
}

function closeAuthModal() {
  document.getElementById('modal-auth').hidden = true;
  document.getElementById('auth-error').hidden = true;
}

function switchAuthTab(mode) {
  document.getElementById('auth-tab-login').classList.toggle('active', mode === 'login');
  document.getElementById('auth-tab-register').classList.toggle('active', mode === 'register');
  document.getElementById('form-login').hidden = mode !== 'login';
  document.getElementById('form-register').hidden = mode !== 'register';
  document.getElementById('auth-error').hidden = true;
}

function showAuthError(message) {
  const el = document.getElementById('auth-error');
  el.textContent = message;
  el.hidden = false;
}

async function handleLogin(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { email: form.get('email'), password: form.get('password') },
    });
    setToken(data.access_token);
    await loadSession();
    closeAuthModal();
    toast(t('logged_in'));
  } catch (error) {
    showAuthError(error.message);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  try {
    await api('/auth/register', {
      method: 'POST',
      body: {
        username: form.get('username'),
        email: form.get('email'),
        password: form.get('password'),
      },
    });
    const data = await api('/auth/login', {
      method: 'POST',
      body: { email: form.get('email'), password: form.get('password') },
    });
    setToken(data.access_token);
    await loadSession();
    closeAuthModal();
    toast(t('registered'));
  } catch (error) {
    showAuthError(error.message);
  }
}

export function initAuth() {
  document.getElementById('btn-profile').addEventListener('click', async () => {
    openPanel('panel-profile');
    if (state.user) {
      await Promise.all([loadFavorites(), loadHistory()]);
    }
  });

  document.getElementById('btn-open-login').addEventListener('click', () => openAuthModal('login'));
  document.getElementById('btn-open-register').addEventListener('click', () => openAuthModal('register'));
  document.getElementById('auth-tab-login').addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('auth-tab-register').addEventListener('click', () => switchAuthTab('register'));
  document.querySelector('.modal-close').addEventListener('click', closeAuthModal);
  document.getElementById('modal-auth').addEventListener('click', (event) => {
    if (event.target.id === 'modal-auth') closeAuthModal();
  });

  document.getElementById('form-login').addEventListener('submit', handleLogin);
  document.getElementById('form-register').addEventListener('submit', handleRegister);
  document.getElementById('btn-logout').addEventListener('click', logout);

  document.getElementById('tab-favorites').addEventListener('click', () => {
    document.getElementById('tab-favorites').classList.add('active');
    document.getElementById('tab-history').classList.remove('active');
    document.getElementById('favorites-list').hidden = false;
    document.getElementById('history-list').hidden = true;
  });
  document.getElementById('tab-history').addEventListener('click', () => {
    document.getElementById('tab-history').classList.add('active');
    document.getElementById('tab-favorites').classList.remove('active');
    document.getElementById('history-list').hidden = false;
    document.getElementById('favorites-list').hidden = true;
  });

  loadSession();
}
