import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const origin = 'https://mizanora.example';
const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const shell = await readFile(new URL('../public/offline.html', import.meta.url), 'utf8');
assert.match(shell, /id="retry"/);
assert.match(shell, /location\.reload\(\)/);
assert.match(shell, /server filhal available nahi/i);

function harness() {
  const listeners = new Map();
  const stores = new Map();
  const timers = new Map();
  let timerId = 0;
  let fetcher = async () => { throw new Error('network unavailable'); };
  let skips = 0;
  let claims = 0;
  const key = (req) => new URL(typeof req === 'string' ? req : req.url, origin).href;
  class MemoryCache {
    data = new Map();
    async match(req) { return this.data.get(key(req))?.clone(); }
    async put(req, res) { this.data.set(key(req), res.clone()); }
    async delete(req) { return this.data.delete(key(req)); }
    async keys() { return [...this.data.keys()].map((url) => ({ url })); }
  }
  const caches = {
    async open(name) { if (!stores.has(name)) stores.set(name, new MemoryCache()); return stores.get(name); },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const self = {
    location: new URL(origin),
    addEventListener(type, callback) { listeners.set(type, callback); },
    async skipWaiting() { skips += 1; },
    clients: { async claim() { claims += 1; } },
  };
  vm.runInNewContext(source, {
    self, caches, URL, Response, AbortController, Promise, Set,
    fetch: (...args) => fetcher(...args),
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
  }, { filename: 'sw.js' });
  const dispatch = (type, request) => {
    const waits = [];
    let response;
    listeners.get(type)({
      request,
      waitUntil(promise) { waits.push(Promise.resolve(promise)); },
      respondWith(promise) { response = Promise.resolve(promise); },
    });
    return { response, done: () => Promise.all(waits) };
  };
  return {
    caches, stores, timers, dispatch,
    setFetch(fn) { fetcher = fn; },
    fire(ms) {
      const found = [...timers.entries()].filter(([, timer]) => timer.ms === ms);
      assert.ok(found.length, `expected a ${ms} ms timer, got ${[...timers.values()].map((x) => x.ms)}`);
      for (const [id, timer] of found) { timers.delete(id); timer.fn(); }
    },
    get skips() { return skips; },
    get claims() { return claims; },
  };
}

const request = (path, options = {}) => ({
  url: new URL(path, origin).href, method: options.method || 'GET', mode: options.mode || 'navigate',
  cache: options.cache || 'default', headers: new Headers(options.headers || {}),
});
const html = (text, headers = {}) => new Response(text, {
  headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, s-maxage=86400', ...headers },
});
const defer = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise((resolve) => setImmediate(resolve));

const successfulInstall = harness();
successfulInstall.setFetch(async () => html('pre-cached fallback'));
await successfulInstall.dispatch('install').done();
assert.equal(successfulInstall.skips, 1);
assert.equal(await (await (await successfulInstall.caches.open('mz-v6-fallback')).match('/offline.html')).text(), 'pre-cached fallback');

const blockedStorage = harness();
blockedStorage.caches.keys = async () => { throw new Error('storage blocked'); };
await blockedStorage.dispatch('activate').done();
assert.equal(blockedStorage.claims, 1, 'blocked Cache Storage must not prevent the worker from claiming pages');

const sw = harness();
await sw.dispatch('install').done();
assert.equal(sw.skips, 1, 'install succeeds even when the offline shell cannot be downloaded');
await sw.caches.open('mz-v5');
await sw.caches.open('another-app');
await sw.dispatch('activate').done();
assert.equal(sw.claims, 1);
assert.ok(!(await sw.caches.keys()).includes('mz-v5'), 'old Mizanora cache is removed');
assert.ok((await sw.caches.keys()).includes('another-app'), 'other apps\' caches are preserved');

sw.setFetch(async () => html('fresh product list'));
let event = sw.dispatch('fetch', request('/products'));
assert.equal(await (await event.response).text(), 'fresh product list');
await event.done();
const pages = await sw.caches.open('mz-v6-pages');
assert.equal(await (await pages.match(`${origin}/products`)).text(), 'fresh product list');

// A slow, previously visited page is usable quickly, but the same network request continues
// and updates the cached copy rather than wasting the eventual response.
let pending = defer();
sw.setFetch(() => pending.promise);
event = sw.dispatch('fetch', request('/products'));
await flush();
sw.fire(3000);
assert.equal(await (await event.response).text(), 'fresh product list');
pending.resolve(html('new product list'));
await event.done();
assert.equal(await (await pages.match(`${origin}/products`)).text(), 'new product list');

// With no saved copy, a response taking longer than the old 8s cutoff must not be called offline.
pending = defer();
sw.setFetch(() => pending.promise);
event = sw.dispatch('fetch', request('/new-page'));
await flush();
assert.ok([...sw.timers.values()].some((t) => t.ms === 20000));
assert.ok(![...sw.timers.values()].some((t) => t.ms === 8000));
pending.resolve(html('slow but online'));
assert.equal(await (await event.response).text(), 'slow but online');
await event.done();

// Network failure -> cached public copy, or a fallback even if no shell could be precached.
sw.setFetch(async () => { throw new Error('offline'); });
event = sw.dispatch('fetch', request('/products'));
assert.equal(await (await event.response).text(), 'new product list');
await event.done();
event = sw.dispatch('fetch', request('/never-visited'));
let response = await event.response;
assert.equal(response.status, 503);
assert.match(await response.text(), /server filhal available nahi/);
await event.done();

// Timeout for an uncached page has the same safe fallback, and the fetch is still observed.
pending = defer();
sw.setFetch(() => pending.promise);
event = sw.dispatch('fetch', request('/very-slow'));
await flush();
sw.fire(20000);
assert.equal((await event.response).status, 503);
pending.reject(new Error('network failed later'));
await event.done();

// A genuine server error must be shown, not mislabeled offline or hidden by a stale page.
sw.setFetch(async () => new Response('deployment paused', { status: 402 }));
event = sw.dispatch('fetch', request('/products'));
response = await event.response;
assert.equal(response.status, 402);
assert.equal(await response.text(), 'deployment paused');
await event.done();
assert.equal(await (await pages.match(`${origin}/products`)).text(), 'new product list');

// A cached public route can later become private or disappear. Its stale copy is then removed.
sw.setFetch(async () => html('private now', { 'cache-control': 'private, no-store' }));
event = sw.dispatch('fetch', request('/products'));
assert.equal(await (await event.response).text(), 'private now');
await event.done();
assert.equal(await pages.match(`${origin}/products`), undefined);
sw.setFetch(async () => html('public again'));
event = sw.dispatch('fetch', request('/products'));
await event.response; await event.done();
sw.setFetch(async () => new Response('gone', { status: 404 }));
event = sw.dispatch('fetch', request('/products'));
await event.response; await event.done();
assert.equal(await pages.match(`${origin}/products`), undefined);

// Browser reloads use request.cache=no-cache: they must not reuse a stale response, but a
// successful public response should still be saved for subsequent ordinary offline visits.
sw.setFetch(async () => html('before reload'));
event = sw.dispatch('fetch', request('/reload'));
await event.response; await event.done();
sw.setFetch(async () => { throw new Error('offline during reload'); });
event = sw.dispatch('fetch', request('/reload', { cache: 'no-cache' }));
assert.equal((await event.response).status, 503, 'a no-cache request does not use the stale page');
await event.done();
sw.setFetch(async () => html('after reload'));
event = sw.dispatch('fetch', request('/reload', { cache: 'no-cache' }));
assert.equal(await (await event.response).text(), 'after reload');
await event.done();
assert.equal(await (await pages.match(`${origin}/reload`)).text(), 'after reload');

// Never persist private routes, arbitrary query strings, authorization, or no-store responses.
sw.setFetch(async () => html('must not be cached'));
for (const path of ['/checkout', '/checkout/address', '/cart', '/account', '/thank-you', '/track', '/worker', '/wishlist', '/products?q=private', '/product/x?token=secret']) {
  event = sw.dispatch('fetch', request(path));
  await event.response; await event.done();
}
for (const options of [{ headers: { authorization: 'Bearer private' } }, { cache: 'no-store' }]) {
  event = sw.dispatch('fetch', request('/sensitive', options));
  await event.response; await event.done();
}
sw.setFetch(async () => html('private', { 'cache-control': 'private, no-store' }));
event = sw.dispatch('fetch', request('/no-store'));
await event.response; await event.done();
sw.setFetch(async () => new Response('unmarked', { headers: { 'content-type': 'text/html' } }));
event = sw.dispatch('fetch', request('/unmarked'));
await event.response; await event.done();
sw.setFetch(async () => html('cookie-dependent', { vary: 'Accept-Encoding, Cookie' }));
event = sw.dispatch('fetch', request('/varies-by-cookie'));
await event.response; await event.done();
const privateRedirect = html('thank-you page');
Object.defineProperty(privateRedirect, 'redirected', { value: true });
Object.defineProperty(privateRedirect, 'url', { value: `${origin}/thank-you` });
sw.setFetch(async () => privateRedirect);
event = sw.dispatch('fetch', request('/order-success'));
await event.response; await event.done();
const keys = (await pages.keys()).map((r) => r.url);
assert.ok(!keys.some((url) => /checkout|cart|account|thank-you|order-success|track|worker|wishlist|sensitive|no-store|unmarked|varies-by-cookie|\?|token/.test(url)));

// The PWA start URL safely shares the canonical home entry, not a query-string cache key.
sw.setFetch(async () => html('home'));
event = sw.dispatch('fetch', request('/?source=pwa'));
await event.response; await event.done();
assert.equal(await (await pages.match(`${origin}/`)).text(), 'home');
assert.equal(sw.dispatch('fetch', request('/api/health')).response, undefined);
assert.equal(sw.dispatch('fetch', request('/admin')).response, undefined);
assert.equal(sw.dispatch('fetch', request('/products', { method: 'POST' })).response, undefined);
assert.equal(sw.dispatch('fetch', request('/img/a.jpg', { mode: 'same-origin' })).response, undefined);

// Hashed assets are cached separately and work offline without evicting pages.
sw.setFetch(async () => new Response('hashed-js', { headers: { 'content-type': 'text/javascript' } }));
event = sw.dispatch('fetch', request('/_next/static/chunks/a.js', { mode: 'same-origin' }));
assert.equal(await (await event.response).text(), 'hashed-js');
await event.done();
sw.setFetch(async () => { throw new Error('should not fetch a cached asset'); });
event = sw.dispatch('fetch', request('/_next/static/chunks/a.js', { mode: 'same-origin' }));
assert.equal(await (await event.response).text(), 'hashed-js');
await event.done();

// An asset-cache lookup failure must not prevent an online network response.
const normalOpen = sw.caches.open;
sw.caches.open = async (name) => name === 'mz-v6-static' ? { match: async () => { throw new Error('storage blocked'); } } : normalOpen(name);
sw.setFetch(async () => new Response('asset from network'));
event = sw.dispatch('fetch', request('/_next/static/chunks/new.js', { mode: 'same-origin' }));
assert.equal(await (await event.response).text(), 'asset from network');
await event.done();
sw.caches.open = normalOpen;
sw.setFetch(async () => { throw new Error('offline'); });

// The separate static shell is used when it was successfully precached.
const fallback = await sw.caches.open('mz-v6-fallback');
await fallback.put('/offline.html', html('cached standalone fallback'));
event = sw.dispatch('fetch', request('/missing'));
assert.equal(await (await event.response).text(), 'cached standalone fallback');
await event.done();

// Even if Cache Storage itself is unavailable, navigation receives a usable inline fallback.
const originalOpen = sw.caches.open;
sw.caches.open = async () => { throw new Error('storage blocked'); };
event = sw.dispatch('fetch', request('/storage-blocked'));
response = await event.response;
assert.equal(response.status, 503);
assert.match(await response.text(), /Try again/);
await event.done();
sw.caches.open = originalOpen;

// Bounded storage: browsing many pages cannot grow the worker cache forever.
sw.setFetch(async () => html('public page'));
for (let i = 0; i < 45; i += 1) {
  event = sw.dispatch('fetch', request(`/public-${i}`));
  await event.response; await event.done();
}
assert.ok((await pages.keys()).length <= 40);
console.log('Service worker: offline recovery, slow networks, privacy, errors, cache limits and asset caching OK.');
