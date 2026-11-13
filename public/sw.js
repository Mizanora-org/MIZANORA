/* Mizanora PWA: fresh pages first, with a safe offline fallback. */
const VERSION = 'mz-v6';
const PAGE_CACHE = `${VERSION}-pages`;
const STATIC_CACHE = `${VERSION}-static`;
const FALLBACK_CACHE = `${VERSION}-fallback`;
const OFFLINE_URL = '/offline.html';
const MAX_PAGES = 40;
const MAX_STATIC = 150;
const CACHED_TIMEOUT_MS = 3000;
const UNCACHED_TIMEOUT_MS = 20000;

// A tiny static shell does not depend on Next, Firebase, or a successful page render.
// Its download is optional: installation must still succeed if the server is having trouble.
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(OFFLINE_URL, { cache: 'reload', signal: controller.signal });
      if (res.ok) await (await caches.open(FALLBACK_CACHE)).put(OFFLINE_URL, res);
    } catch (_) { /* the built-in fallback below still works */ }
    finally { clearTimeout(timer); }
    await self.skipWaiting();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keep = new Set([PAGE_CACHE, STATIC_CACHE, FALLBACK_CACHE]);
      // Do not delete caches owned by another app on the same origin.
      const old = (await caches.keys()).filter((key) => /^mz-v\d+(?:$|-)/.test(key) && !keep.has(key));
      await Promise.all(old.map((key) => caches.delete(key)));
    } catch (_) { /* claim pages even when Cache Storage is blocked */ }
    await self.clients.claim();
  })());
});

async function trim(cache, max) {
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((key) => cache.delete(key)));
}

const privatePaths = ['/api', '/admin', '/account', '/cart', '/checkout', '/thank-you', '/track', '/worker', '/wishlist'];
function pageCacheKey(req, url) {
  if (privatePaths.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) return null;
  if (req.headers.get('authorization') || req.cache === 'no-store') return null;
  // Queries can contain tokens, personal searches, or filters. Never store them as cache keys.
  // The PWA start URL is the sole exception: it has the same content as the home page.
  if (url.search) {
    const params = [...url.searchParams.entries()];
    if (url.pathname !== '/' || params.length !== 1 || params[0][0] !== 'source' || params[0][1] !== 'pwa') return null;
  }
  return `${url.origin}${url.pathname}`;
}

function canStorePage(res) {
  const control = res.headers.get('cache-control') || '';
  const type = res.headers.get('content-type') || '';
  const vary = res.headers.get('vary') || '';
  // Only explicitly shared-cacheable HTML is safe. An unmarked response, or one varying by
  // user credentials, could be personalized even when its URL looks public.
  return res.ok && /\btext\/html\b/i.test(type) && /\bpublic\b|\bs-maxage\s*=\s*[1-9]\d*/i.test(control)
    && !/\b(?:private|no-store|no-cache)\b/i.test(control)
    && !/(?:^|,)\s*(?:cookie|authorization|\*)\s*(?:,|$)/i.test(vary);
}

function publicRedirect(req, res) {
  if (!res.redirected) return true;
  try {
    const destination = new URL(res.url);
    // Old public URLs may redirect to checkout, tracking, or a URL containing a token.
    return destination.origin === self.location.origin && Boolean(pageCacheKey(req, destination));
  } catch (_) { return false; }
}

async function offlineResponse() {
  try {
    const cached = await (await caches.open(FALLBACK_CACHE)).match(OFFLINE_URL);
    if (cached) return cached;
  } catch (_) { /* Cache Storage may be unavailable in private browsing. */ }
  // Even if precaching failed there is always a response, rather than a blank browser error.
  return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connection unavailable | Mizanora</title><body style="font-family:system-ui;padding:2rem;line-height:1.5"><h1>Page abhi load nahi ho saka</h1><p>Internet slow ho sakta hai ya server filhal available nahi hai. Dobara try karein.</p><button onclick="location.reload()">Try again</button><script>window.addEventListener("online",function(){location.reload()},{once:true})</script></body></html>', {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // API and admin responses must never be intercepted or saved.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/') || url.pathname === '/admin' || url.pathname.startsWith('/admin/')) return;

  if (req.mode === 'navigate') {
    const key = pageCacheKey(req, url);
    const cachePromise = key ? caches.open(PAGE_CACHE).catch(() => null) : Promise.resolve(null);
    const network = Promise.resolve().then(() => fetch(req));

    // Keep the network fetch alive when a cached page wins the timeout. If it eventually succeeds,
    // the next visit gets the fresh page. Never store errors, private/no-store responses or queries.
    event.waitUntil(network.then(async (res) => {
      if (!key) return;
      const store = canStorePage(res) && publicRedirect(req, res);
      // A route that is now private, denied, or deleted must not keep serving its old public copy.
      const evict = !store && (res.ok || [401, 403, 404, 410].includes(res.status));
      if (!store && !evict) return;
      // Clone before yielding: the browser may start consuming the original as soon as it resolves.
      const copy = store ? res.clone() : null;
      const cache = await cachePromise;
      if (!cache) return;
      if (copy) { await cache.put(key, copy); await trim(cache, MAX_PAGES); }
      else await cache.delete(key);
    }).catch(() => {}));

    event.respondWith((async () => {
      let saved = null;
      try {
        // A normal browser reload can use request.cache='no-cache': do not answer it with a
        // stale page, but do save a successful network response for later offline visits.
        const cache = await cachePromise;
        const hit = req.cache !== 'no-cache' && cache && await cache.match(key);
        if (hit && canStorePage(hit)) saved = hit;
      } catch (_) { /* use network */ }
      let timer;
      const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve({ timeout: true }), saved ? CACHED_TIMEOUT_MS : UNCACHED_TIMEOUT_MS); });
      const result = await Promise.race([
        network.then((response) => ({ response }), () => ({ failed: true })),
        timeout,
      ]);
      clearTimeout(timer);
      // Preserve actual HTTP errors (including a Vercel pause) rather than calling them offline.
      if (result.response) return result.response;
      return saved || offlineResponse();
    })());
    return;
  }

  // Only Next's content-hashed build assets are cached indefinitely. Other images use normal
  // browser/CDN caching; refreshing them from the worker on every hit wastes origin transfer.
  if (url.pathname.startsWith('/_next/static/')) {
    const result = (async () => {
      let cache = null;
      try {
        cache = await caches.open(STATIC_CACHE);
        const hit = await cache.match(req);
        if (hit) return { response: hit, cache: null };
      } catch (_) { cache = null; /* Cache Storage is unavailable; fetch normally. */ }
      return { response: await fetch(req), cache };
    })();
    event.waitUntil(result.then(async ({ response, cache }) => {
      if (cache && response.ok && !/\b(?:private|no-store|no-cache)\b/i.test(response.headers.get('cache-control') || '')) {
        await cache.put(req, response.clone());
        await trim(cache, MAX_STATIC);
      }
    }).catch(() => {}));
    event.respondWith(result.then(({ response }) => response));
  }
});
