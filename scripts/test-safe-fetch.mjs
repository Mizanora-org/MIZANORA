// Offline SSRF regression tests. No outbound network traffic.
import assert from 'node:assert/strict';
import { isPrivateIp, publicUrl, readLimited, resolvePublicHost, safePublicFetch } from '../lib/safeFetch.js';

for (const ip of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '100.64.1.2', '192.0.2.1', '198.18.1.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1']) {
  assert.equal(isPrivateIp(ip), true, ip);
}
for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700::1111']) assert.equal(isPrivateIp(ip), false, ip);
for (const u of ['http://127.0.0.1/a', 'https://0177.0.0.1/a', 'https://[::1]/', 'https://user:pass@cdn.example/a', 'file:///etc/passwd', 'http://localhost/a', 'https://a.internal/a', 'https://singlehost/a']) {
  assert.throws(() => publicUrl(u), undefined, u);
}
assert.equal(publicUrl('https://images.example/a.jpg', { httpsOnly: true, hosts: ['example'] }).hostname, 'images.example');
assert.throws(() => publicUrl('https://markaz.app.evil.example/a', { hosts: ['markaz.app'] }), /host/);
assert.throws(() => publicUrl('https://evil.markaz.app/a', { hosts: ['markaz.app'], exactHosts: true }), /host/);
assert.throws(() => publicUrl('http://public.example/a', { httpsOnly: true }), /protocol/);

const stub = async (addrs) => addrs;
assert.deepEqual(await resolvePublicHost('a.example', () => stub([{ address: '8.8.8.8', family: 4 }])), [{ address: '8.8.8.8', family: 4 }]);
await assert.rejects(() => resolvePublicHost('a.example', () => stub([{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }])), /private/);
await assert.rejects(() => resolvePublicHost('a.example', () => stub([{ address: '8.8.8.8', family: 4 }, { address: '169.254.169.254', family: 4 }])), /private/);
await assert.rejects(() => resolvePublicHost('127.0.0.1', () => { throw new Error('should not use DNS for literal IP'); }), /private/);
let n = 0;
const transport = async (_u, options) => { n++; assert.equal(options.redirect, 'manual'); assert.ok(options.dispatcher, 'pinned connector is passed'); return new Response('', { status: 302, headers: { location: 'http://127.0.0.1/admin' } }); };
await assert.rejects(() => safePublicFetch('https://cdn.example/a', { transport }), /private/);
assert.equal(n, 1, 'private redirect refused before connecting to hop 2');
await assert.rejects(() => safePublicFetch('https://cdn.example/a', { httpsOnly: true, transport: async () => new Response('', { status: 302, headers: { location: 'http://other.example/a' } }) }), /protocol/);
await assert.rejects(() => safePublicFetch('https://markaz.app/a', { hosts: ['markaz.app'], exactHosts: true, transport: async () => new Response('', { status: 302, headers: { location: 'https://evil.markaz.app/a' } }) }), /host/);
assert.equal((await safePublicFetch('https://cdn.example/a', { transport: async () => new Response('ok') })).res.status, 200);
const large = new Response('x'.repeat(1024), { headers: { 'content-length': '2' } });
await assert.rejects(() => readLimited(large, 100), /large/, 'lying Content-Length is capped while streaming');
assert.equal((await readLimited(new Response('small'), 100)).toString(), 'small');
console.log('Safe fetch: IP ranges, rebinding DNS, redirect hops, host policy and byte cap OK.');
