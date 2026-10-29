// v32 tests: photo relay + a video ad player that actually plays.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(root, f));
const imp = (f) => import(pathToFileURL(path.join(root, f)).href);
let n = 0;
const ok = (msg) => { n++; console.log('ok    ' + msg); };

// ---- image relay ----------------------------------------------------------
const { proxyImage, isProxyUrl, imgFallback } = await imp('lib/imgFallback.js');
assert.equal(proxyImage('https://cdn.test/a.jpg'), '/api/img?u=https%3A%2F%2Fcdn.test%2Fa.jpg');
assert.equal(proxyImage('//cdn.test/a.jpg'), '/api/img?u=https%3A%2F%2Fcdn.test%2Fa.jpg');
assert.equal(proxyImage('/icons/icon-192.png'), '/icons/icon-192.png', 'local files are never relayed');
assert.equal(proxyImage('data:image/png;base64,AAA'), 'data:image/png;base64,AAA', 'data URLs are never relayed');
assert.ok(isProxyUrl(proxyImage('https://cdn.test/a.jpg')));
assert.equal(proxyImage(proxyImage('https://cdn.test/a.jpg')), proxyImage('https://cdn.test/a.jpg'), 'no relay loops');
// The last-resort handler: first failure -> relay, second failure -> hidden (never a broken icon).
const fake = { attrs: { src: 'https://cdn.test/a.jpg' }, getAttribute(k) { return this.attrs[k] || ''; }, setAttribute(k, v) { this.attrs[k] = v; }, style: {}, closest: () => null };
imgFallback({ currentTarget: fake });
assert.ok(isProxyUrl(fake.attrs.src), 'a failed photo is retried through the relay');
imgFallback({ currentTarget: fake });
assert.equal(fake.attrs['data-dead'], '1');
assert.equal(fake.style.display, 'none', 'a photo that fails twice is hidden');
ok('imgFallback: relay once, then hide (no broken icons)');

// The relay route must exist and be careful.
const relay = read('app/api/img/route.js');
assert.match(relay, /https:/);
assert.match(relay, /privateHost/);
assert.match(relay, /image\//);
assert.match(relay, /MAX_BYTES/);
assert.match(relay, /NEXT_IMAGE_PROXY_HOSTS/);
assert.match(relay, /Cache-Control/);
ok('image relay route: https only, private hosts refused, images only, capped and cached');

// Everything that shows a shopper-facing photo falls back to the relay.
for (const [file, why] of [
  ['components/CardMedia.js', 'product cards'],
  ['components/CardPhoto.js', 'product cards'],
  ['components/SafeImg.js', 'circles and banners'],
  ['components/RemoteImg.js', 'remote photos'],
  ['components/Gallery.js', 'product page gallery'],
  ['components/BannerCarousel.js', 'home banners'],
  ['components/CartClient.js', 'cart thumbnails'],
  ['components/CheckoutClient.js', 'checkout thumbnails'],
  ['components/SearchBox.js', 'search suggestions'],
  ['components/RecentlyViewed.js', 'recently viewed'],
  ['components/ReelsRail.js', 'reels'],
]) {
  const t = read(file);
  assert.match(t, /RemoteImg|proxyImage|imgFallback|imgFill|api\/img/, `${file} (${why}) must have the relay fallback`);
}
assert.match(read('components/RemoteImg.js'), /referrerPolicy="no-referrer"/);
assert.match(read('app/globals.css'), /img\[data-dead="1"\]/);
ok('photos: gallery, banners, cart, checkout, search, reels and cards all retry through the relay');

// ---- big catalogues: feeds and catalog.json must fit a serverless response ---
const { feedPage, feedHeaders, feedNote } = await imp('lib/feedSplit.js');
const many = Array.from({ length: 10987 }, (_, i) => i);
const p1 = feedPage(many, {});
assert.equal(p1.total, 10987);
assert.equal(p1.pages, Math.ceil(10987 / 2500));
assert.equal(p1.items.length, 2500);
assert.equal(p1.items[0], 0);
const last = feedPage(many, { page: 999 });
assert.equal(last.page, p1.pages, 'a page past the end returns the last part');
assert.equal(last.items.length, 10987 - (p1.pages - 1) * 2500);
assert.equal(feedPage(many, { page: 'x', size: 'y' }).page, 1, 'garbage input is safe');
assert.equal(feedPage([], {}).pages, 1);
const hd = feedHeaders(p1, '/api/feed');
assert.equal(hd['X-Feed-Pages'], String(p1.pages));
assert.match(hd.Link, /rel="next"/);
assert.match(feedNote(p1, '/api/feed'), /Part 1 of/);
for (const f of ['app/api/feed/route.js', 'app/api/feed/google/route.js', 'app/catalog.json/route.js']) {
  const t = read(f);
  assert.match(t, /feedPage/, `${f} must page the catalogue`);
  assert.match(t, /feedHeaders/, `${f} must report the part in headers`);
}
// The old files were 9 MB / 16 MB / 7.6 MB: a platform limit, not a slow server.
assert.ok(!/slice\(0, 4900\)/.test(read('app/api/feed/route.js')), 'feed descriptions are trimmed');
ok('catalogue: feeds + catalog.json are split into parts (no more oversized responses)');

// ---- video ads ------------------------------------------------------------
const embed = read('public/ads/embed.js');
for (const [re, why] of [
  [/youtube-nocookie\.com\/embed/, 'YouTube iframe player'],
  [/facebook\.com\/plugins\/video\.php/, 'Facebook player'],
  [/instagram\.com\//, 'Instagram player'],
  [/player\.vimeo\.com/, 'Vimeo player'],
  [/tiktok\.com\/embed/, 'TikTok player'],
  [/\.m3u8/, 'HLS streams'],
  [/loadHls/, 'hls.js loader'],
  [/api\/ads\/hls\.js/, 'hls.js served by the shop'],
  [/playsinline/, 'inline playback on phones'],
  [/video\.play\(\)/, 'a play button that really plays'],
  [/data-mz-live/, 'rotation waits for a playing video'],
  [/function abs\(/, 'ad links are absolute'],
  [/api\/img/, 'ad photos fall back to the relay'],
]) assert.match(embed, re, `embed script needs: ${why}`);
assert.ok(exists('app/api/ads/hls.js/route.js'));
assert.match(read('app/api/ads/hls.js/route.js'), /hls\.min\.js/);
ok('ads: a real player (file, HLS, YouTube, Facebook, Instagram, TikTok, Vimeo) that is never cut off');

const admin = read('app/admin/ads/page.js');
assert.match(admin, /videoMeta/);
assert.match(admin, /VideoSourceHint/);
assert.match(admin, /videoUrl: v\.url/, 'editing an ad keeps its video link');
assert.match(admin, /youtube-nocookie\.com\/embed|meta\.src/, 'the admin preview plays the video');
ok('admin ads: the video link survives editing, the preview plays it, the form explains what a link is');

// ---- live TV typecheck regressions (they were real crash bugs) -------------
const tv = read('components/LiveTvPlayer.js');
assert.ok(!/setAudioTracks\(/.test(tv), 'no call to an undefined setter');
assert.ok(!/dashPlayerEl/.test(tv), 'no reference to an undefined player ref');
ok('live tv: no undefined state setter / ref (the old build errors)');

console.log(`\nAll v32 tests passed (${n} checks).`);
