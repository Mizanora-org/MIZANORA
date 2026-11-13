// Run: node --experimental-loader ./scripts/test-security-loader.mjs scripts/test-security.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { POST } from '../app/api/admin/security/route.js';
import { middleware, config as middlewareConfig } from '../middleware.js';
import { signToken, verifyToken } from '../lib/adsToken.js';
import { POST as adImpression } from '../app/api/ads/impression/route.js';
import { POST as adClick } from '../app/api/ads/click/route.js';
import { POST as trackOrder } from '../app/api/track/route.js';
import { backupOrder } from '../lib/orderFallback.js';
import { readLimitedJson } from '../lib/readLimitedJson.js';
import { noteFirestoreError } from '../lib/quota.js';
import { POST as telemetry } from '../app/api/telemetry/route.js';
import { GET as retentionCron } from '../app/api/cron/security/route.js';
import { verifyAdmin as realVerifyAdmin } from '../lib/adminAuth.js';
import { logSecurityEvent, pruneSecurityEvents, securityIp, securityReport, ipKey, pkDay } from '../lib/securityControl.js';
import { limitRequest } from '../lib/requestRate.js';

// The standalone recovery shell and worker must not invoke middleware or depend on RTDB.
const { unstable_doesMiddlewareMatch } = createRequire(import.meta.url)('next/experimental/testing/server');
for (const url of ['/offline.html', '/sw.js', '/_next/static/example.js']) {
  assert.equal(unstable_doesMiddlewareMatch({ config: middlewareConfig, url }), false, `${url} bypasses middleware`);
}
for (const url of ['/products', '/api/orders']) {
  assert.equal(unstable_doesMiddlewareMatch({ config: middlewareConfig, url }), true, `${url} stays protected`);
}

const rows = new Map();
let seq = 0;
const ref = (path = '') => ({
  filterDate: '', cap: 0,
  limitToFirst(n) { this.cap = n; return this; }, limitToLast(n) { this.cap = n; return this; },
  orderByKey() { return this; }, endAt(date) { this.filterDate = date; return this; },
  async get() { return this.once('value'); },
  async once() {
    let value = rows.get(path) || null;
    if (value && this.filterDate) value = Object.fromEntries(Object.entries(value).filter(([k]) => k <= this.filterDate).slice(0, this.cap || 100));
    return { val: () => value };
  },
  async set(value) {
    rows.set(path, value); const parts = path.split('/'); if (parts.length > 1) {
      const parent = parts.slice(0, -1).join('/'); rows.set(parent, { ...rows.get(parent), [parts.at(-1)]: value });
    }
  },
  async remove() {
    rows.delete(path); const parts = path.split('/'); const parent = parts.slice(0, -1).join('/');
    if (rows.has(parent)) { const cur = { ...rows.get(parent) }; delete cur[parts.at(-1)]; rows.set(parent, cur); }
  },
  async update(obj) {
    for (const [key, value] of Object.entries(obj)) {
      const child = ref([path, key].filter(Boolean).join('/'));
      if (value === null) await child.remove();
      else if (value && 'incrementBy' in value) await child.set((rows.get([path, key].filter(Boolean).join('/')) || 0) + value.incrementBy);
      else await child.set(value);
    }
  },
  async push(value) { const key = `event-${seq++}`; await ref(`${path}/${key}`).set(value); return { key }; },
});
globalThis.__securityTest = { db: { ref } };
globalThis.__adsTest = { impressions: [], clicks: [] };
process.env.TRUST_PROXY_HEADERS = '1';
process.env.ADMIN_UID = 'owner';
process.env.TELEMETRY_SECRET = 'offline-test-secret';
process.env.CRON_SECRET = 'offline-cron-secret';
const address = '8.8.4.4';
const request = (pathname, ip = address, authorization = '') => {
  const url = `https://mizanora.example${pathname}`;
  return { url, nextUrl: new URL(url), headers: new Headers({
    'x-forwarded-for': ip, 'user-agent': 'Browser <test>', ...(authorization ? { authorization } : {}),
  }) };
};
const call = async (body, ip = '1.1.1.1', authorized = true) => {
  const res = await POST(new Request('https://mizanora.example/api/admin/security', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip,
      ...(authorized ? { authorization: 'Bearer owner' } : {}) }, body: JSON.stringify(body),
  }));
  return { status: res.status, body: await res.json() };
};

assert.equal(securityIp(new Headers({ 'x-forwarded-for': `${address}, 127.0.0.1` })), address);
assert.equal(securityIp(new Headers({ 'x-forwarded-for': 'fake, 1.1.1.1' })), '');
delete process.env.TRUST_PROXY_HEADERS;
assert.equal(securityIp(new Headers({ 'x-forwarded-for': address })), '', 'untrusted proxy header is ignored');
process.env.TRUST_PROXY_HEADERS = '1';
assert.equal(limitRequest('test', address, 1, 30000, 10).allowed, true);
assert.equal(limitRequest('test', address, 1, 30000, 11).allowed, false);
assert.equal(limitRequest('test', address, 1, 30000, 30011).allowed, true);

assert.equal((await call({ action: 'list' }, address, false)).status, 401);
assert.equal((await call({ action: 'block', ip: address }, address)).status, 409, 'owner cannot block their own current IP');
const block = await call({ action: 'block', ip: address, reason: 'Repeated probes', hours: 1 });
assert.equal(block.status, 200);
assert.equal(block.body.blocked.ip, address);
assert.ok(rows.has(`security/blocked/${ipKey(address)}`), 'durable block key is hashed, value private');
assert.equal((await middleware(request('/api/orders', address))).status, 403, 'blocked IP cannot use order API');
assert.equal((await middleware(request('/products', address))).status, 403, 'blocked IP cannot view dynamic pages');
assert.equal((await middleware(request('/admin/security', address))).status, 200, 'verified-owner recovery page remains reachable');
assert.equal((await middleware(request('/api/admin/security', address))).status, 200, 'verified-owner recovery API remains reachable');
assert.equal((await middleware(request('/products', '1.1.1.1'))).status, 200, 'other visitors still work');
const result = await call({ action: 'list', days: 1 });
assert.equal(result.body.blocked.length, 1);
assert.equal((await call({ action: 'unblock', ip: address })).status, 200);
assert.equal((await middleware(request('/products', address))).status, 200, 'unblock takes effect immediately in this instance');

const badReq = request('/.env?token=do-not-log', address);
assert.equal((await middleware(badReq)).status, 404);
assert.equal((await logSecurityEvent(request('/api/img?u=https://user:secret@cdn.example/photo', address), 'image-relay-invalid', { reason: 'blocked-redirect', severity: 'high' })), true);
const report = await securityReport(1);
assert.ok(report.events.length >= 2 && report.alerts >= 1);
const logged = JSON.stringify(report.events);
assert.ok(!logged.includes('do-not-log') && !logged.includes('secret@') && !logged.includes('<test>'), 'no URL queries, passwords or HTML in audit logs');
assert.ok(report.events.some((e) => e.ip === address && e.route === '/.env'));

assert.equal((await realVerifyAdmin(request('/api/admin/auth', address))).status, 401, 'missing token fails closed');
assert.equal((await realVerifyAdmin(request('/api/admin/auth', address, 'Bearer expired'))).status, 401, 'expired Firebase token fails closed');
assert.equal((await realVerifyAdmin(request('/api/admin/auth', address, 'Bearer other'))).status, 403, 'verified but non-admin UID denied');
assert.equal((await realVerifyAdmin(request('/api/admin/auth', address, 'Bearer owner'))).ok, true, 'verified configured admin UID accepted');
const tracking = (body, ip = '3.3.3.3', origin = 'https://mizanora.example') => telemetry(new Request('https://mizanora.example/api/telemetry', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, origin }, body: JSON.stringify(body),
}));
const visitor = 'testvisitor123';
assert.equal((await tracking({ type: 'page', vid: visitor, path: '/products?secret=do-not-save', newDay: true, device: 'mobile', source: 'direct' })).status, 204);
assert.equal((await tracking({ type: 'page', vid: visitor, path: '/products', newDay: true, device: 'mobile', source: 'direct' })).status, 204);
assert.equal(rows.get(`stats/d/${pkDay()}/uv`), 1, 'same visitor counted only once in daily unique count per worker');
assert.equal(rows.get(`stats/d/${pkDay()}/views`), 2, 'valid views batched on the server');
const presence = [...rows.entries()].find(([key]) => key.startsWith('presence/') && key !== 'presence')?.[1];
assert.equal(presence.p, '/products', 'analytics never stores query strings');
assert.ok(!JSON.stringify([...rows.values()]).includes('do-not-save'), 'query not stored in RTDB');
assert.equal((await tracking({ type: 'event', vid: visitor, kind: 'pv', key: 'my-product' })).status, 204);
assert.equal(rows.get(`stats/ev/${pkDay()}/view`), 1);
assert.equal((await tracking({ type: 'event', vid: visitor, kind: 'ev', key: 'order' })).status, 400, 'customer cannot forge order metrics');
assert.equal((await tracking({ type: 'event', vid: visitor, kind: 'ev', key: '../../ordersBackup' })).status, 400, 'arbitrary DB paths rejected');
assert.equal((await tracking({ type: 'page', vid: visitor }, '3.3.3.3', 'https://evil.example')).status, 403, 'cross-origin writes denied');
assert.equal((await tracking({ type: 'page', vid: visitor, padding: 'x'.repeat(3000) })).status, 400, 'oversized bodies rejected');
assert.equal((await middleware(request('/api/telemetry', address))).status, 200, 'unblocked telemetry route is reachable');
assert.equal((await retentionCron(new Request('https://mizanora.example/api/cron/security'))).status, 401, 'cron cannot run without shared secret');
const old = pkDay(Date.now() - 40 * 86400_000);
await ref(`security/events/${old}`).set({ e: { kind: 'probe' } });
assert.equal((await retentionCron(new Request('https://mizanora.example/api/cron/security', {
  headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
}))).status, 200);
assert.equal(rows.has(`security/events/${old}`), false, 'retention deletes all overdue day buckets');
assert.ok((await pruneSecurityEvents()) >= 0);
const huge = new Request('https://mizanora.example/api/telemetry', { method: 'POST', duplex: 'half',
  body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4096)); controller.close(); } }),
});
await assert.rejects(() => readLimitedJson(huge, 2048), /too large/i, 'chunked bodies without a length are capped');
const fallbackInput = { body: { payMethod: 'COD' }, clean: { name: 'Buyer', phone: '03001234567', city: 'Kasur' },
  rawItems: [{ id: 'sku-1', qty: 2, price: 1 }] }; // browser price MUST be ignored
const fallback = await backupOrder(fallbackInput);
assert.equal(fallback.status, 200, 'quota backup accepts an eligible order with no Firestore reads');
const fallbackSaved = (await fallback.json()).order;
assert.equal(fallbackSaved.items[0].price, 2500, 'archived product price, never client-supplied price');
assert.equal(fallbackSaved.subtotal, 5000);
assert.equal(rows.get(`ordersBackup/${fallbackSaved.orderId}`).total, fallbackSaved.total, 'private RTDB backup actually saved');
assert.ok(rows.get(`stats/d/${pkDay()}/orders`) >= 1, 'backup increments daily order counter');
assert.equal((await backupOrder({ ...fallbackInput, body: { coupon: 'FAKE' } })).status, 503, 'unverified coupons cannot be accepted during outage');
assert.equal((await backupOrder({ ...fallbackInput, rawItems: [{ id: 'sku-1', qty: 2, deal: 'forged' }] })).status, 400, 'forged discounts rejected during outage');
const order = { orderId: 'MZ-ABCDEF12', customer: { phone: '03001234567' }, status: 'Pending', items: [], total: 1234 };
await ref(`ordersBackup/${order.orderId}`).set(order);
noteFirestoreError(new Error('RESOURCE_EXHAUSTED'));
const trackReq = (phone) => new Request('https://mizanora.example/api/track', {
  method: 'POST', headers: { 'x-forwarded-for': '7.7.7.7', 'content-type': 'application/json' },
  body: JSON.stringify({ orderId: order.orderId, phone }),
});
const tracked = await trackOrder(trackReq('03001234567'));
assert.equal(tracked.status, 200, 'customer can track backup order while Firestore quota is open');
assert.equal((await tracked.json()).order.total, 1234);
assert.equal((await trackOrder(trackReq('03009999999'))).status, 404, 'wrong phone cannot read another order');
assert.equal((await trackOrder(trackReq('03001234567'.repeat(300)))).status, 400, 'oversized lookup refused');
assert.equal(rows.size > 0, true);
const postAd = (fn, body) => fn(new Request('https://mizanora.example/api/ads/track', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '6.6.6.6' }, body: JSON.stringify(body),
}));
const selfToken = signToken('self', 'camp1');
assert.equal(verifyToken(signToken('self', 'camp1', 60000, 'mizanora-ads-v1')), null, 'old public signing constant no longer works');
assert.equal((await postAd(adImpression, { key: 'self', campaign: 'camp1', token: selfToken })).status, 204);
assert.equal((await postAd(adImpression, { key: 'self', campaign: 'camp1', token: selfToken })).status, 204);
assert.equal(globalThis.__adsTest.impressions.length, 1, 'replayed token does not write twice');
assert.equal((await postAd(adImpression, { key: 'mza_valid', campaign: 'camp1', token: selfToken })).status, 403, 'self token cannot credit another key');
assert.equal((await postAd(adImpression, { key: 'self', campaign: 'camp1', token: signToken('self', 'camp1', 60000, 'mizanora-ads-v1') })).status, 403);
const validKey = await import('node:crypto').then(({ createHash }) => createHash('sha256').update('mza_valid').digest('hex'));
const click = await postAd(adClick, { key: 'mza_valid', campaign: 'camp1', token: signToken(validKey, 'camp1'), href: 'javascript:alert(1)' });
assert.equal(click.status, 200);
assert.equal('href' in (await click.json()), false, 'click response never echoes untrusted redirect');
assert.equal(globalThis.__adsTest.clicks.length, 1);
assert.equal((await postAd(adClick, { key: 'mza_valid', campaign: 'other', token: signToken(validKey, 'other') })).status, 401, 'key cannot credit forbidden campaign');

// A disconnected RTDB must not hang every page in middleware. Use a fresh module instance so the
// first call represents a cold serverless worker, and leave its database promise unresolved.
const slowSecurity = await import(new URL('../lib/securityControl.js?timeout-test', import.meta.url));
const originalDb = globalThis.__securityTest.db;
let reads = 0, detached = 0;
const unresolved = [];
const stalledDb = { ref(path) {
  if (path !== 'security/blocked') return originalDb.ref(path);
  return {
    once() { reads += 1; return new Promise((resolve) => unresolved.push(resolve)); },
    off() { detached += 1; },
  };
} };
try {
  globalThis.__securityTest.db = stalledDb;
  const started = Date.now();
  const cold = await Promise.all([slowSecurity.blockedIp(address), slowSecurity.blockedIp(address)]);
  assert.deepEqual(cold, [null, null], 'a cold worker fails open when RTDB is unavailable');
  assert.ok(Date.now() - started < 3000, 'blocklist read is bounded');
  assert.equal(reads, 1, 'concurrent visitors share the same blocklist read');
  assert.equal(detached, 1, 'timed-out listener is detached');
  await slowSecurity.blockedIp(address);
  assert.equal(reads, 1, 'failure backs off instead of retrying on every request');
  await assert.rejects(slowSecurity.setBlockedIp('9.9.9.9'), /timed out/, 'admin block writes fail closed when the list cannot be verified');
  assert.equal(rows.has(`security/blocked/${ipKey('9.9.9.9')}`), false);

  // A refresh failure on a warm instance must continue enforcing the last successful blocklist.
  globalThis.__securityTest.db = originalDb;
  rows.set('security/blocked', { [ipKey(address)]: { ip: address, until: Date.now() + 60000 } });
  await slowSecurity.blockedMap(true);
  globalThis.__securityTest.db = stalledDb;
  await assert.rejects(slowSecurity.blockedMap(true), /timed out/);
  assert.equal((await slowSecurity.blockedIp(address)).ip, address, 'known blocks survive an outage');
  unresolved.forEach((resolve) => resolve({ val: () => ({}) }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await slowSecurity.blockedIp(address)).ip, address, 'a late stale read cannot overwrite the retained list');
} finally {
  globalThis.__securityTest.db = originalDb;
}
console.log('Security integration: auth, private audit, bounded blocklist, retention, telemetry, quota-backed orders/tracking and ads token safety OK.');
