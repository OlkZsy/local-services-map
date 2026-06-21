/**
 * map.js — карта Leaflet: тайлы, геолокация, маркеры, кластеризация, popup.
 */
import { state } from './app.js';
import { t, catIcon, catName, formatDistance, escapeHtml, toast } from './ui.js';
import { toggleFavorite, isFavorite } from './auth.js';

let map = null;
let userMarker = null;
let radiusCircle = null;
let cluster = null;
const markersById = new Map(); // osm_id -> L.Marker

export function initMap() {
  const center = state.config.default_center || { lat: 51.2465, lng: 22.5684 };
  map = L.map('map', { zoomControl: false }).setView([center.lat, center.lng], 14);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // MapTiler при наличии ключа, иначе бесплатные тайлы OpenStreetMap
  const key = state.config.maptiler_api_key;
  if (key) {
    // Тайлы MapTiler отдаются 512x512 — задаём tileSize/zoomOffset, иначе карта
    // рендерится не в том масштабе и выглядит размытой. @2x — чёткость на retina.
    L.tileLayer(`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}@2x.png?key=${key}`, {
      attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; OpenStreetMap contributors',
      tileSize: 512,
      zoomOffset: -1,
      minZoom: 1,
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map);
  } else {
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
  }

  cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 60 });
  map.addLayer(cluster);

  document.getElementById('btn-locate').addEventListener('click', () => locateUser(true));
  locateUser(false);
}

export function locateUser(showError) {
  if (!navigator.geolocation) {
    if (showError) toast(t('geolocation_denied'));
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude: lat, longitude: lng } = position.coords;
      state.userLocation = { lat, lng };
      setUserMarker(lat, lng);
      map.setView([lat, lng], 15);
    },
    () => { if (showError) toast(t('geolocation_denied')); },
    { enableHighAccuracy: true, timeout: 10000 },
  );
}

function setUserMarker(lat, lng) {
  if (userMarker) userMarker.remove();
  userMarker = L.marker([lat, lng], {
    icon: L.divIcon({ className: '', html: '<div class="user-marker"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
    zIndexOffset: 1000,
  }).addTo(map);
}

/** Центр для поиска: геолокация пользователя или центр карты. */
export function getSearchCenter() {
  if (state.userLocation) return state.userLocation;
  const center = map.getCenter();
  return { lat: center.lat, lng: center.lng };
}

export function drawRadius(lat, lng, radiusMeters) {
  if (radiusCircle) radiusCircle.remove();
  radiusCircle = L.circle([lat, lng], {
    radius: radiusMeters,
    color: '#2563eb',
    weight: 1.5,
    fillColor: '#2563eb',
    fillOpacity: 0.07,
  }).addTo(map);
  map.fitBounds(radiusCircle.getBounds(), { padding: [30, 30] });
}

export function clearMap() {
  cluster.clearLayers();
  markersById.clear();
  if (radiusCircle) { radiusCircle.remove(); radiusCircle = null; }
}

function markerIcon(service) {
  const status = service.is_open === true ? 'open' : (service.is_open === false ? 'closed' : 'unknown');
  return L.divIcon({
    className: '',
    html: `<div class="poi-marker ${status}">${catIcon(service.category)}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 32],
    popupAnchor: [0, -30],
  });
}

function popupHtml(service) {
  const address = [service.address?.street, service.address?.city].filter(Boolean).join(', ');
  const status = service.is_open === true
    ? `<span class="status-open">🟢 ${t('open')}</span>`
    : service.is_open === false
      ? `<span class="status-closed">🔴 ${t('closed')}</span>`
      : `<span class="status-unknown">⚪ ${t('no_data')}</span>`;

  return `
    <div class="popup">
      <h3>${escapeHtml(service.name)}</h3>
      <div class="muted">${escapeHtml(catName(service.category))} · 📏 ${formatDistance(service.distance)}</div>
      ${address ? `<div class="muted">📍 ${escapeHtml(address)}</div>` : ''}
      <div>${status}</div>
      ${service.opening_hours ? `<div class="muted">🕐 ${escapeHtml(service.opening_hours)}</div>` : ''}
      ${service.phone ? `<div>📞 <a href="tel:${escapeHtml(service.phone)}">${escapeHtml(service.phone)}</a></div>` : ''}
      ${service.website ? `<div>🌐 <a href="${escapeHtml(service.website)}" target="_blank" rel="noopener">WWW</a></div>` : ''}
      <button class="fav-btn ${isFavorite(service.osm_id) ? 'active' : ''}" data-osm-id="${escapeHtml(service.osm_id)}">
        ⭐ ${isFavorite(service.osm_id) ? '−' : '+'}
      </button>
    </div>
  `;
}

export function renderMarkers(results) {
  cluster.clearLayers();
  markersById.clear();

  for (const service of results) {
    const marker = L.marker([service.lat, service.lng], { icon: markerIcon(service) });
    marker.bindPopup(() => popupHtml(service));
    marker.on('popupopen', (event) => {
      const btn = event.popup.getElement().querySelector('.fav-btn');
      if (btn) btn.addEventListener('click', () => toggleFavorite(service));
    });
    markersById.set(service.osm_id, marker);
    cluster.addLayer(marker);
  }
}

/** Перерисовка иконок/попапов (после смены языка или избранного). */
export function refreshMarkers() {
  if (state.results.length) renderMarkers(state.results);
}

export function focusService(osmId) {
  const marker = markersById.get(osmId);
  if (!marker) return;
  map.setView(marker.getLatLng(), 17);
  cluster.zoomToShowLayer(marker, () => marker.openPopup());
}

export function flyTo(lat, lng, zoom = 16) {
  map.setView([lat, lng], zoom);
}
