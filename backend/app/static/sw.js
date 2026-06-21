// Service worker: offline access via a network-first strategy.
// When online, a fresh version is always served (edits are visible immediately),
// while the cache acts as a fallback when there is no network.

const CACHE = 'lsm-v1';

const APP_SHELL = [
  '/',
  '/static/css/style.css',
  '/static/js/app.js',
  '/static/js/map.js',
  '/static/js/search.js',
  '/static/js/ui.js',
  '/static/js/auth.js',
  '/static/js/reviews.js',
  '/static/manifest.webmanifest',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Don't cache API requests — they must always go to the network.
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // refresh the cache with a fresh copy of same-origin resources
        if (url.origin === self.location.origin && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/'))),
  );
});
