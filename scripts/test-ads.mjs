import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const imp = (f) => import(pathToFileURL(path.join(root, f)).href);
const { cleanAd, cleanStats, cleanConfig, scoreAd, pickAds, budgetLeft, buildCreative, videoMeta, absoluteHref, normalizeSlot, canRenderInSlot, AD_TYPES, ANIM_PRESETS, todayKey } = await imp('lib/ads.js');
const { signToken, verifyToken } = await imp('lib/adsToken.js');

// ---- shaping --------------------------------------------------------------
const html = cleanAd({ type: 'html', html: '<div onclick="x()"><script>alert(1)</script><b>Hi</b></div>' });
assert.equal(html.type, 'html');
assert.ok(html.html.includes('<b>Hi</b>'));
assert.ok(!/script|onclick|onclick/i.test(html.html), 'scripts and handlers stripped');
const bad = cleanAd({ type: 'not-a-type', name: '<script>x</script>', price: '99' });
assert.equal(bad.type, 'banner');
assert.ok(!bad.name.includes('<script>'));
assert.equal(cleanAd({ type: 'video', videoUrl: 'https://x.test/a.mp4', skipAfter: 999, muted: false }).video.skipAfter, 30);
assert.equal(cleanAd({ type: 'video', muted: false }).video.muted, false);
assert.equal(cleanAd({ type: 'animation', anim: 'nope' }).anim, 'float');
const ad = cleanAd({ type: 'banner', headline: 'Hello', cta: '', href: 'example.com' });
assert.equal(ad.cta, 'Visit');
assert.equal(ad.href, 'https://example.com');

// ---- video ads: every link shape is kept (the old form lost ad.video.url on edit)
const fromVideoObject = cleanAd({ type: 'video', video: { url: 'https://youtu.be/dQw4w9WgXcQ', poster: 'https://x.test/p.jpg', skipAfter: 0 } });
assert.equal(fromVideoObject.video.url, 'https://youtu.be/dQw4w9WgXcQ');
assert.equal(fromVideoObject.video.poster, 'https://x.test/p.jpg');
assert.equal(fromVideoObject.video.skipAfter, 0);
assert.equal(cleanAd({ type: 'video' }).video.skipAfter, 5);
assert.equal(cleanAd({ type: 'video', video: { muted: false } }).video.muted, false);
assert.equal(videoMeta('https://youtu.be/dQw4w9WgXcQ').kind, 'iframe');
assert.equal(videoMeta('https://www.facebook.com/watch/?v=123').kind, 'iframe');
assert.equal(videoMeta('https://cdn.test/live.m3u8').kind, 'hls');
assert.equal(videoMeta('https://cdn.test/ad.mp4').kind, 'file');
assert.equal(videoMeta('').kind, '');
assert.equal(normalizeSlot('AUTO'), '');
assert.equal(normalizeSlot('video'), 'video');
assert.equal(canRenderInSlot(cleanAd({ type: 'banner', img: 'https://x.test/a.jpg' }), 'video'), true);

// An ad link is absolute: "/deals" opened on another website must land on the shop.
assert.equal(absoluteHref('/deals', 'https://mizanora.vercel.app'), 'https://mizanora.vercel.app/deals');
assert.equal(absoluteHref('https://x.test/a', 'https://mizanora.vercel.app'), 'https://x.test/a');
const ytCreative = buildCreative(cleanAd({ type: 'video', videoUrl: 'https://youtu.be/dQw4w9WgXcQ', href: '/deals' }), { token: 't', clickToken: 'c', base: 'https://mizanora.vercel.app' });
assert.equal(ytCreative.href, 'https://mizanora.vercel.app/deals');
assert.equal(ytCreative.video.kind, 'iframe');
assert.ok(ytCreative.video.src.includes('youtube-nocookie.com/embed/dQw4w9WgXcQ'));
assert.ok(ytCreative.video.poster.includes('ytimg.com'));
assert.equal(ytCreative.ctoken, 'c');

// ---- stats / budget -------------------------------------------------------
const today = todayKey();
assert.deepEqual(cleanStats({ impressions: -5, days: { bad: 1, [today]: { i: 3, c: 1 } } }).days[today], { i: 3, c: 1 });
assert.equal(budgetLeft(cleanAd({ dailyImpressions: 100 }), { days: { [today]: { i: 40 } } }), 60);
assert.equal(budgetLeft(cleanAd({}), { days: {} }), Infinity);
assert.equal(budgetLeft(cleanAd({ dailyImpressions: 10 }), { days: { [today]: { i: 11 } } }) <= 0, true);

// ---- auto-optimise engine -------------------------------------------------
const stats = {
  good: { impressions: 2000, clicks: 200 },   // 10% CTR
  bad: { impressions: 2000, clicks: 4 },      // 0.2% CTR
  none: { impressions: 0, clicks: 0 },
};
const ads = {
  good: cleanAd({ id: 'good', type: 'banner', priority: 0, createdAt: Date.now() }),
  bad: cleanAd({ id: 'bad', type: 'banner', priority: 0, createdAt: Date.now() }),
  none: cleanAd({ id: 'none', type: 'banner', priority: 10, createdAt: Date.now() }), // priority only
};
assert.ok(scoreAd(ads.good, stats.good) > scoreAd(ads.bad, stats.bad), 'better CTR scores higher');
// priority is a strong, admin-controlled boost (up to +120)
assert.ok(scoreAd({ ...ads.good, priority: 10 }, stats.good) > scoreAd(ads.good, stats.good), 'priority boosts score');
assert.ok(scoreAd({ ...ads.good, createdAt: Date.now() - 30 * 86400000 }, stats.good) < scoreAd(ads.good, stats.good), 'fresh ads score slightly higher');

// Weighted random: the good ad must win clearly. 2000 trials keep this test
// statistically stable (300 trials made it flaky: ~18% false failures).
let good = 0, bad2 = 0;
for (let i = 0; i < 2000; i++) {
  const picked = pickAds([ads.good, ads.bad], { good: stats.good, bad: stats.bad }, { count: 1 });
  if (picked[0].id === ads.good.id) good++; else bad2++;
}
assert.ok(good > bad2 * 1.2, `good ad rotates in more often (${good} vs ${bad2})`);
const multi = pickAds([ads.good, ads.bad, ads.none], { good: stats.good, bad: stats.bad, none: stats.none }, { count: 2 });
assert.equal(multi.length, 2);
assert.deepEqual(pickAds([{ ...ads.good, status: 'paused' }], {}, { count: 1 }), [], 'paused ads never serve');
// non-autooptimised ads fall back to priority
const prio = pickAds([cleanAd({ id: 'p5', type: 'banner', priority: 5, autoOptimize: false }), cleanAd({ id: 'p0', type: 'banner', priority: 0, autoOptimize: false })], {}, { count: 1, autoOptimize: true });
assert.equal(prio.length, 1);
// A "video" slot gets video ads (not a banner), and falls back only when there is no video ad.
const mixed = [
  cleanAd({ id: 'v1', type: 'video', video: { url: 'https://cdn.test/a.mp4' }, createdAt: Date.now() }),
  cleanAd({ id: 'b1', type: 'banner', headline: 'banner', createdAt: Date.now() }),
];
for (let i = 0; i < 30; i++) assert.equal(pickAds(mixed, {}, { count: 1, type: 'video' })[0].id, 'v1');
const onlyBanner = [cleanAd({ id: 'b2', type: 'banner', img: 'https://cdn.test/a.jpg', createdAt: Date.now() })];
assert.equal(pickAds(onlyBanner, {}, { count: 1, type: 'video' })[0].id, 'b2');

// ---- tokens ---------------------------------------------------------------
const t = signToken('key1', 'camp1', 60000);
assert.deepEqual(verifyToken(t), { keyId: 'key1', campaignId: 'camp1' });
assert.equal(verifyToken(t.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'))), null, 'tampered token rejected');
assert.equal(verifyToken(signToken('key1', 'camp1', -1000)), null, 'expired token rejected');
assert.equal(verifyToken('garbage'), null);
assert.equal(verifyToken(signToken('key2', 'camp1', 60000), 'other-secret'), null, 'secret matters');

// ---- config --------------------------------------------------------------
const cfg = cleanConfig({ rotateMs: 100, perView: 99, enabled: 'yes', autoOptimize: 0 });
assert.equal(cfg.rotateMs, 2000);
assert.equal(cfg.perView, 10);
assert.equal(cfg.enabled, true);
assert.equal(cfg.autoOptimize, false);

// ---- embed script + routes (the wiring must stay intact) -------------------
const embed = read('public/ads/embed.js');
assert.match(embed, /data-mz-ads/);
assert.match(embed, /api\/ads\/serve/);
assert.match(embed, /api\/ads\/['"] \+ kind/); // impression + click endpoints (built at runtime)
assert.match(embed, /['"]impression['"]/);
assert.match(embed, /['"]click['"]/);
assert.match(embed, /prefers-reduced-motion/);
assert.match(embed, /mza-anim-/);
assert.match(embed, /IntersectionObserver/);
assert.match(embed, /window\.MZADS_API/);
// v32: real players, not a black box
assert.match(embed, /youtube-nocookie\.com\/embed/);
assert.match(embed, /loadHls/);
assert.match(embed, /api\/ads\/hls\.js/);
assert.match(embed, /api\/img/);

const serve = read('app/api/ads/serve/route.js');
assert.match(serve, /Access-Control-Allow-Origin/);
assert.match(serve, /serveAds/);
const adsServer = read('lib/adsServer.js');
assert.match(adsServer, /k === 'self'/);
assert.match(adsServer, /showOnShop/);
assert.match(adsServer, /ownOrigins/);
assert.match(read('app/api/img/route.js'), /NEXT_IMAGE_PROXY_HOSTS/);
assert.match(read('app/api/ads/hls.js/route.js'), /hls\.min\.js/);
const admin = read('app/api/admin/ads/route.js');
assert.match(admin, /verifyAdmin/);
assert.match(admin, /createKey/);
assert.match(admin, /saveAd/);
const rules = read('firestore.rules');
assert.match(rules, /match \/ads\/\{id\}/);
assert.match(rules, /match \/adKeys\/\{id\}.*false/);
const nav = read('components/AdminNav.js');
assert.match(nav, /Ads API/);

// ---- catalogue sanity ------------------------------------------------------
assert.equal(AD_TYPES.length, 5);
assert.equal(ANIM_PRESETS.length, 8);
assert.match(read('app/globals.css'), /mza-anim-float/);

console.log('ok    ads: shaping, sanitisation, scoring, weighted picks, budget, tokens, config');
console.log('ok    ads: embed script + routes wiring (serve/track/CORS/rules/nav)');
console.log('\nAll ads (v31) tests passed.');
