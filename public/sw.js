/* Mizanora service worker: offline fallback + fast repeat visits. Never touches /api or /admin. */
const VERSION = 'mz-v4';
const PRECACHE = ['/', '/offline', '/products', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png'];
const MAX_ENTRIES = 300;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

// The page can ask a freshly installed worker to take over immediately (the app then reloads itself once).
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_ENTRIES) await Promise.all(keys.slice(0, keys.length - MAX_ENTRIES).map((k) => cache.delete(k)));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/admin')) return;

  // Pages: network first so prices and stock are fresh. If the network is very slow (over 8 s) or gone, show the
  // last copy of that page, else the offline page. (Before, a weak connection could hang forever.)
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const res = await Promise.race([
          fetch(req),
          new Promise((_, no) => setTimeout(() => no(new Error('slow')), 8000)),
        ]);
        if (res && res.ok) { cache.put(req, res.clone()); trim(cache); } // every page you visit stays readable offline
        return res;
      } catch (_) {
        return (await cache.match(req)) || (url.pathname === '/' && (await cache.match('/'))) || (await caches.match('/offline'));
      }
    })());
    return;
  }

  // Hashed build files never change: serve from cache, no background refresh (saves data and keeps scrolling smooth).
  if (url.pathname.startsWith('/_next/static')) {
    e.respondWith(caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { cache.put(req, res.clone()); trim(cache); }
      return res;
    }));
    return;
  }

  // Product photos and icons: cache first, refresh quietly only when the copy is older than a day.
  if (url.pathname.startsWith('/_next/image') || /\.(png|jpe?g|webp|avif|svg|ico|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) {
        const age = Date.now() - Number(new Date(hit.headers.get('date') || 0));
        if (age > 864e5) fetch(req).then((res) => { if (res.ok) cache.put(req, res); }).catch(() => {});
        return hit;
      }
      const res = await fetch(req);
      if (res.ok) { cache.put(req, res.clone()); trim(cache); }
      return res;
    }));
  }
});
