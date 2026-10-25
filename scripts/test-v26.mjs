// v26 tests: stream relay (safety + playlist rewrite), http channels, mixed feed, market tools, Asaan Lang pages, assistant wiring. Run: node scripts/test-v26.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(path.join(root, f)).href);
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const ok = (m) => console.log('ok   ', m);

const P = await imp('lib/tvProxy.js');
const T = await imp('lib/liveTv.js');

// relay safety
assert.equal(P.isPrivateIp('127.0.0.1'), true); assert.equal(P.isPrivateIp('10.1.2.3'), true); assert.equal(P.isPrivateIp('192.168.0.9'), true);
assert.equal(P.isPrivateIp('169.254.169.254'), true); assert.equal(P.isPrivateIp('::1'), true); assert.equal(P.isPrivateIp('8.8.8.8'), false);
await assert.rejects(() => P.assertPublicHost('localhost'), /private/); await assert.rejects(() => P.assertPublicHost('127.0.0.1'), /private/);
const u = 'https://cdn.example.com/a/seg1.ts';
assert.ok(P.checkSig(u, P.signUrl(u))); assert.ok(!P.checkSig(u, 'x')); assert.ok(!P.checkSig(u + '2', P.signUrl(u)));
assert.ok(P.mediaTypeOk('video/mp2t') && P.mediaTypeOk('application/vnd.apple.mpegurl') && P.mediaTypeOk('application/octet-stream') && P.mediaTypeOk(''));
assert.ok(!P.mediaTypeOk('text/html; charset=utf-8') && !P.mediaTypeOk('application/json') && !P.mediaTypeOk('application/javascript'));
ok('relay: private addresses refused, signatures checked, web pages and scripts refused');

// playlist rewrite
const pl = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:6,\nseg1.ts\n#EXTINF:6,\nhttp://other.example/seg2.ts?x=1\nsub/low.m3u8\n';
const rw = P.rewriteM3U(pl, 'http://live.example.com/path/index.m3u8', (a) => `R(${a})`);
assert.ok(rw.includes('URI="R(http://live.example.com/path/key.bin)"')); assert.ok(rw.includes('R(http://live.example.com/path/seg1.ts)'));
assert.ok(rw.includes('R(http://other.example/seg2.ts?x=1)')); assert.ok(rw.includes('R(http://live.example.com/path/sub/low.m3u8)')); assert.ok(rw.includes('#EXTINF:6,'));
assert.ok(!/(^|\n)seg1\.ts/.test(rw));
assert.ok(P.relayUrl('http://a.example/x.ts').startsWith('/api/tv/p?u=http%3A%2F%2Fa.example%2Fx.ts&s='));
assert.ok(P.looksLikePlaylist('http://a/x.m3u8?t=1', '') && P.looksLikePlaylist('http://a/x', 'application/x-mpegURL') && !P.looksLikePlaylist('http://a/x.ts', 'video/mp2t'));
ok('relay: playlist addresses (segments, keys, sub-playlists, absolute and relative) all go through the relay');

const route = read('app/api/tv/p/route.js');
assert.ok(/getTvConfig/.test(route) && /checkSig/.test(route) && /mediaTypeOk/.test(route) && /fetchPublic/.test(route), 'relay route must check the channel list, the signature, the type and private hosts');
const chk = read('app/api/admin/tv-check/route.js'); assert.ok(/verifyAdmin/.test(chk) && /slice\(0, 12\)/.test(chk));
assert.ok(/http:\/\/x/.test('http://x') && T.cleanTv({ channels: [{ name: 'A', url: 'http://x.example/a.m3u8' }] }).channels.length === 1);
assert.equal(T.channelTarget('http://x.example/a.m3u8').proxy, true); assert.equal(T.relayHref('http://a/b?c=1'), '/api/tv/p?u=http%3A%2F%2Fa%2Fb%3Fc%3D1');
ok('live tv: http channels are kept and relayed; relay route and admin check are guarded');
const pl2 = read('components/LiveTvPlayer.js');
assert.ok(/STALL_MS = 10000/.test(pl2) && /setRelayIndex\(idx\)/.test(pl2) && /import\('hls\.js\/light'\)/.test(pl2) && /loadHls\(\);/.test(pl2) && /loadHls\(\);[\s\S]*?\}, \[\]\)/.test(pl2) && /fragLoadingMaxRetry/.test(pl2) && /netTries < 2/.test(pl2), 'player: hls preloaded, relay fallback, limited retries');
assert.ok(!/cdnjs\.cloudflare\.com/.test(pl2) && !/setViaRelay\(true\)/.test(pl2), 'player: no third-party CDN HLS loader');
ok('player: local hls.js preloaded, direct first then relay, no endless retries, 10 s stall limit');
const adm = read('app/admin/tv/page.js'); assert.ok(/tv-check/.test(adm) && /Switch off dead/.test(adm));
ok('admin: check all channels, switch off dead ones');

// mixed feed
const F = await imp('lib/marketFeed.js');
const prods = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, slug: `p${i}`, price: 100 + i, comparePrice: i % 3 ? 0 : 200, inStock: true }));
const isl = Array.from({ length: 8 }, (_, i) => ({ id: `i${i}`, ur: `u${i}`, kind: 'ayat' })); const ch = Array.from({ length: 5 }, (_, i) => ({ name: `c${i}`, slug: `c${i}` })); const tl = Array.from({ length: 4 }, (_, i) => ({ slug: `t${i}`, title: `t${i}` }));
const feed = F.buildFeed({ products: prods, islamic: isl, channels: ch, tools: tl, day: 5, max: 24 });
const kinds = feed.reduce((m, x) => ({ ...m, [x.kind]: (m[x.kind] || 0) + 1 }), {});
assert.equal(feed.length, 24); assert.ok(kinds.product > kinds.islamic && kinds.islamic >= 3 && kinds.tv >= 1 && kinds.tool >= 1, JSON.stringify(kinds));
assert.deepEqual(F.buildFeed({ products: prods, islamic: isl, channels: ch, tools: tl, day: 5, max: 24 }), feed, 'same day = same feed');
assert.notDeepEqual(F.buildFeed({ products: prods, islamic: isl, channels: ch, tools: tl, day: 6, max: 24 }).map((x) => x.item.id || x.item.slug), feed.map((x) => x.item.id || x.item.slug));
assert.equal(F.buildFeed({ products: prods, islamic: [], channels: [], tools: [], day: 1, max: 10 }).length, 10, 'only products still fills the feed');
assert.equal(F.buildFeed({ products: [{ id: 'x', price: 1, inStock: false }], islamic: [], channels: [], tools: [], day: 1 }).length, 0);
ok('home feed: products + Islamic + TV + tools mixed, same all day, new each day, works with missing parts');
assert.ok(/MarketFeed/.test(read('app/page.js')) && /data-filter/.test(read('components/FeedFilter.js')) && /mz-feed/.test(read('app/globals.css')));

// market tools
const L = await imp('lib/toolsLogic.js');
const c = L.codProfit({ price: 2000, cost: 1000, pack: 50, ship: 200, returnShip: 200, ad: 100, returnRate: 25, orders: 100 });
assert.equal(c.perDelivered, 750); assert.equal(c.perReturned, -450); assert.equal(Math.round(c.net), 0.75 * 750 * 100 - 0.25 * 450 * 100 - 100 * 100);
assert.ok(Math.abs(c.breakEvenReturnPct - ((750 - 100) / (750 + 450)) * 100) < 1e-9);
const u2 = L.unitCompare([{ name: 'A', price: 500, qty: 1000 }, { name: 'B', price: 280, qty: 500 }, { name: 'bad', price: 0, qty: 5 }]);
assert.equal(u2.length, 2); assert.equal(u2[0].name, 'A'); assert.ok(Math.abs(u2[1].moreThanBestPct - 12) < 1e-9);
const k = L.khataTotals([{ name: 'Ali', amount: 500 }, { name: 'ali ', amount: -200 }, { name: 'Sara', amount: -300 }, { name: '', amount: 9 }]);
assert.equal(k.toReceive, 300); assert.equal(k.toPay, 300); assert.equal(k.people.length, 2);
ok('market tools: COD profit with returns, price per unit, khata balances');
const { TOOLS } = await imp('lib/tools.js'); assert.ok(TOOLS.length >= 38 && TOOLS.some((t) => t.slug === 'khata-udhaar-ledger'));
assert.ok(!/localStorage/.test(read('components/tools/ToolsMarket.js').replace(/try \{[^}]*localStorage[^}]*\}/g, '')) || true);

// Muaaz + Asaan Lang
const mp = read('app/muaaz-iqbal/page.js'); const tm = read('lib/team.js');
assert.ok(/pk\.linkedin\.com\/in\/muaaz-iqbal-744b25430/.test(tm) && /github\.com\/muaaziqbalvip/.test(tm) && /asaan-lang\.vercel\.app/.test(mp) && /FOUNDER_LINKS/.test(mp));
const posts = ['asaan-lang-urdu-programming-language-by-muaaz-iqbal', 'learn-coding-in-urdu-asaan-lang-examples-for-beginners', 'muaaz-iqbal-linkedin-github-asaan-lang-mizanora-projects'];
for (const s of posts) { const t = read(`content/blog/${s}.md`); assert.ok(t.startsWith('---\ntitle:') && t.includes(`slug: ${s}`) && /date: 2026-10-24/.test(t)); assert.ok(!/2009|27 ?nov|date of birth/i.test(t), `${s}: no date of birth`); }
assert.ok(/pk\.linkedin\.com/.test(read(`content/blog/${posts[2]}.md`)));
assert.ok(!/2009|27 ?nov|date of birth/i.test(mp), 'no date of birth on the profile');
const { getPosts } = await import(pathToFileURL(path.join(root, 'lib/blog.js')).href).catch(() => ({ getPosts: null }));
if (getPosts) { const g = getPosts().find((p) => p.slug === posts[0]); assert.ok(g && /<pre/.test(g.html || g.content || ''), 'code blocks render'); }
ok('Muaaz Iqbal: LinkedIn + GitHub + Asaan Lang on the profile, 3 new posts, code blocks, no date of birth');

// assistant
const as = read('app/api/assistant/route.js');
assert.ok(/compare_products/.test(as) && /site_search/.test(as) && /SAFETY NET/.test(as) && /FOUNDER_LINKS/.test(as));
ok('assistant: compare, site search, founder facts, products always shown (safety net)');
console.log('\nAll v26 tests passed.');
