/* ===================================================================
   All Conductor — Service Worker
   Estrategia:
   - App shell (index.html, manifest, iconos) -> cache-first con
     revalidación en segundo plano (stale-while-revalidate).
   - Navegaciones -> network-first con fallback al shell cacheado.
   - CDNs (Tailwind, Leaflet, fuentes, Lucide) -> cache-first runtime
     para que la app funcione sin conexión después de la primera visita.
   =================================================================== */

const VERSION = 'allconductor-v1.0.0';
const SHELL_CACHE = `allconductor-shell-${VERSION}`;
const RUNTIME_CACHE = `allconductor-runtime-${VERSION}`;

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

/* ---------- Install ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.allSettled(SHELL_ASSETS.map((asset) => cache.add(new Request(asset, { cache: 'reload' }))))
      )
      .then(() => self.skipWaiting())
  );
});

/* ---------- Activate ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ---------- Helpers ---------- */
const isNavigation = (request) => request.mode === 'navigate';

const isCacheableGet = (request) =>
  request.method === 'GET' && !request.url.startsWith('chrome-extension://');

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;

  const fresh = await network;
  if (fresh) return fresh;

  // Último recurso: página offline mínima (solo para navegaciones)
  if (isNavigation(request)) {
    const shell = await cache.match('./index.html');
    if (shell) return shell;
  }
  return new Response('Recurso no disponible sin conexión.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put('./index.html', response.clone());
    }
    return response;
  } catch (error) {
    const cache = await caches.open(SHELL_CACHE);
    const shell = (await cache.match(request)) || (await cache.match('./index.html')) || (await cache.match('./'));
    return (
      shell ||
      new Response('<h1>All Conductor</h1><p>Sin conexión. Vuelve a abrir la app.</p>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    );
  }
}

/* ---------- Fetch ---------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (!isCacheableGet(request)) return;

  // El mapa (tiles de OpenStreetMap) siempre va a red con fallback a caché.
  if (/tile\.openstreetmap\.org/.test(request.url)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        try {
          const response = await fetch(request);
          if (response && (response.ok || response.type === 'opaque')) {
            cache.put(request, response.clone());
          }
          return response;
        } catch (error) {
          const cachedTile = await cache.match(request);
          return (
            cachedTile ||
            new Response('', { status: 204, statusText: 'offline-tile' })
          );
        }
      })
    );
    return;
  }

  if (isNavigation(request)) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

/* ---------- Mensajes desde la app ---------- */
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (data.type === 'PING') {
    event.source && event.source.postMessage({ type: 'PONG', version: VERSION });
  }
});
