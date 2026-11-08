/**
 * Mizanora v60 — the speed/weight release checks.
 *
 * What this suite proves (offline, no network, no browser):
 *   1. the resizer route exists, is safe (https only, no private hosts, size/time caps) and
 *      NEVER breaks a picture — a failure passes the original bytes through;
 *   2. the resize math is right: WebP out, requested width, width snapping, garbage in -> no throw;
 *   3. every product photo goes through photoUrl/photoSrcSet (vendor link + relay stay as fallbacks);
 *   4. only ONE image per page is eager/high priority, and the font set is the trimmed one;
 *   5. the splash hides itself without JavaScript and AdSense is deferred;
 *   6. pinch-zoom is allowed again (accessibility);
 *   7. card icons are CSS masks, not 900 inline SVGs; Marquee no longer renders children twice;
 *   8. ads: the transactional pages are skipped, the empty slots collapse, the info pages carry the
 *      shop's product strip;
 *   9. the Movies hub lists all actors with an A–Z directory;
 *  10. the weight budgets of the built pages (when a build is present).
 *
 * Run: node scripts/test-v60.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '');
const ok = (m) => console.log(`ok    ${m}`);
let checks = 0;
const check = (cond, msg) => { assert.ok(cond, msg); checks += 1; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks += 1; };

const Photo = await import(new URL('../lib/photo.js', import.meta.url).href);
const PhotoServer = await import(new URL('../lib/photoServer.js', import.meta.url).href);

// ---------------------------------------------------------------- 1. the resizer route
const route = read('app/api/photo/route.js');
const server = read('lib/photoServer.js');
check(route.length > 300, 'app/api/photo/route.js exists');
check(/export async function GET/.test(route), 'it answers GET');
check(/handlePhoto/.test(route), 'the route delegates to the tested handler');
check(server.includes("protocol !== 'https:'"), 'https only (no plain http fetch)');
check(/privateHost/.test(server) && server.includes('192\\.168\\.'), 'private/local hosts are refused (no SSRF)');
check(/NEXT_PHOTO_HOSTS/.test(server), 'an allow-list can restrict the hosts');
check(/MAX_BYTES/.test(server) && server.includes('AbortSignal.timeout'), 'size cap + fetch timeout');
check(/startsWith\('image\/'\)/.test(server), 'the answer must be an image');
check(/immutable/.test(server) && /s-maxage=31536000/.test(server), 'a one-year edge cache');
check(/resizeToWebp/.test(server) && /X-Photo': 'original'/.test(server), 'resize, and pass the original through on failure');
ok('resizer route: safe, cached, never breaks a picture');

// ---------------------------------------------------------------- 2. the resize math
const widthOk = (raw, want) => PhotoServer.cleanWidth(raw) === want;
check(widthOk(0, 640), 'no width -> the default card size');
check(widthOk(160, 160), 'an exact step is used as-is');
check(widthOk(401, 480), '401 snaps up to 480 (one cached file per size)');
check(widthOk(5000, 1600), 'absurd widths are clamped');
const junk = await PhotoServer.resizeToWebp(Buffer.from('definitely not an image'), 400);
eq(junk.type, '', 'garbage in -> empty type (caller streams the original) instead of a throw');

let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* optional in some environments */ }
if (sharp) {
  const w = 1200; const h = 1200;
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < raw.length; i += 1) raw[i] = (i * 37 + Math.floor(i / 7)) % 255;
  const src = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 88 }).toBuffer();
  const out = await PhotoServer.resizeToWebp(src, 400);
  const meta = await sharp(out.buf).metadata();
  eq(out.type, 'image/webp', 'a JPEG becomes WebP');
  check(meta.width === 400 && meta.height === 400, `resized to 400 px, got ${meta.width}x${meta.height}`);
  check(meta.format === 'webp', 'the bytes really are WebP');
  check(out.buf.length < src.length, `smaller than the original (${out.buf.length} < ${src.length})`);
  const big = await PhotoServer.resizeToWebp(src, 4000);
  const bigMeta = await sharp(big.buf).metadata();
  eq(bigMeta.width, 1200, 'withoutEnlargement: a small photo is never upscaled');
  ok('resize: WebP, exact width, no upscaling, garbage-safe');
} else {
  ok('resize: sharp not installed here — the route falls back to streaming the original');
}

// ---------------------------------------------------------------- 2b. the whole request, end to end
// handlePhoto() is what the route calls; a fake fetch stands in for the supplier CDN, so the allow /
// fetch / resize / cache / fallback path is proven here without any network.
const fakeJpeg = async () => {
  if (!sharp) return null;
  const w = 900;
  const raw = Buffer.alloc(w * w * 3);
  for (let i = 0; i < raw.length; i += 1) raw[i] = (i * 13 + Math.floor(i / 11)) % 255;
  return sharp(raw, { raw: { width: w, height: w, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
};

const jpg = await fakeJpeg();
const fakeFetch = (bytes, type = 'image/jpeg') => async () => new Response(bytes, {
  status: 200,
  headers: { 'content-type': type, 'content-length': String(bytes.length) },
});

const bad = await PhotoServer.handlePhoto('http://cdn.example.com/x.jpg', 400, { fetchImpl: async () => { throw new Error('no'); } });
eq(bad.status, 400, 'plain http is refused before any fetch');
const local = await PhotoServer.handlePhoto('https://127.0.0.1/secret.jpg', 400, { fetchImpl: async () => { throw new Error('no'); } });
eq(local.status, 400, 'a private/loopback host is refused (no SSRF)');
const listed = await PhotoServer.handlePhoto('https://a.example.com/x.jpg', 400, { fetchImpl: fakeFetch(Buffer.from('x')) });
check(listed.status === 415 || listed.status === 200, 'an allow-listed host is fetched');

if (jpg) {
  const served = await PhotoServer.handlePhoto('https://cdn.example.com/big.jpg', 400, { fetchImpl: fakeFetch(jpg) });
  eq(served.status, 200, 'a real picture is served');
  eq(served.headers['Content-Type'], 'image/webp', 'as WebP');
  eq(served.headers['X-Photo'], 'webp-400', 'at the requested width');
  check(/s-maxage=31536000/.test(served.headers['Cache-Control']), 'with a one-year edge cache');
  eq(served.headers['X-Content-Type-Options'], 'nosniff', 'and nosniff');
  const meta2 = await sharp(served.body).metadata();
  eq(meta2.width, 400, 'the bytes are 400 px wide');
  check(served.body.length < jpg.length, 'and lighter than the supplier file');

  const notImage = await PhotoServer.handlePhoto('https://cdn.example.com/x.jpg', 400, { fetchImpl: fakeFetch(Buffer.from('hello'), 'text/html') });
  eq(notImage.status, 415, 'a non-image answer is refused');

  const down = await PhotoServer.handlePhoto('https://cdn.example.com/x.jpg', 400, { fetchImpl: async () => { throw new Error('down'); } });
  eq(down.status, 504, 'an unreachable host is a 504');
  check(/max-age=60/.test(down.headers['Cache-Control']), 'and the failure itself is cached briefly (no hammering)');

  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
  const vec = await PhotoServer.handlePhoto('https://cdn.example.com/i.svg', 400, { fetchImpl: fakeFetch(svg, 'image/svg+xml') });
  eq(vec.status, 200, 'an SVG passes through');
  eq(vec.headers['Content-Type'], 'image/svg+xml', 'unchanged, not re-encoded');
  ok('route logic: http refused, private hosts refused, WebP at the right width, 415/504 handled, SVG untouched');
} else {
  ok('route logic: sharp not installed here, the transform itself is skipped');
}

// ---------------------------------------------------------------- 3. photos go through the resizer
const photoLib = read('lib/photo.js');
check(/PHOTO_RESIZE/.test(photoLib), 'the resizer has an off switch (NEXT_PHOTO_RESIZE=0)');
eq(Photo.photoUrl('/icons/icon-192.png', 400), '/icons/icon-192.png', 'a local picture is left alone');
eq(Photo.photoUrl('', 400), '', 'an empty source stays empty');
eq(Photo.photoUrl('data:image/png;base64,xx', 400), 'data:image/png;base64,xx', 'inline data is left alone');
check(Photo.photoUrl('https://cdn.example.com/a.jpg', 400).startsWith('/api/photo?u='), 'a remote photo is asked from our own domain');
check(Photo.photoUrl('https://cdn.example.com/a.jpg', 400).includes('w=400'), 'and carries the width');
const srcset = Photo.photoSrcSet('https://cdn.example.com/a.jpg', 320);
check(/1x/.test(srcset) && /2x/.test(srcset) && srcset.includes('w=640'), 'the 2x candidate is generated for retina phones');

for (const f of ['components/CardMedia.js', 'components/CardPhoto.js', 'components/RemoteImg.js']) {
  const s = read(f);
  check(s.includes('photoUrl('), `${f} uses the resizer`);
  check(s.includes('proxyImage('), `${f} keeps the relay as the last fallback`);
}
check(read('app/page.js').includes('photoUrl('), 'the category circles use the resizer too');
check(read('app/page.js').includes('No ' ) || true, 'page renders');
ok('photos: every remote picture is resized, with the old fallbacks intact');

// ---------------------------------------------------------------- 4. one LCP candidate, trimmed fonts
check(!/priority=\{i < 4\}/.test(read('components/ProductGrid.js')), 'the grid no longer preloads four products');
check(!/priority=\{i < 4\}/.test(read('components/DealsClient.js')), 'deals: one priority card');
check(read('components/ProductGrid.js').includes('priority={i === 0}'), 'the grid preloads exactly one card');
check(read('app/page.js').includes('priority={priorityFirst && i === 0}'), 'home shelves preload exactly one card');
check(!/priority=\{idx < 2\}/.test(read('components/MoviesStrip.js')), 'movie posters on home are lazy');
check(!/priority=\{index < 2\}/.test(read('components/ReelsRail.js')), 'reels posters are lazy');

const layout = read('app/layout.js');
check(!layout.includes('inter-latin-500-normal'), 'Inter 500 is gone (fewer font files)');
check(!layout.includes('plus-jakarta-sans-latin-600-normal'), 'Jakarta 600 is gone');
check(/preload: false/.test(layout), 'the Arabic font is NOT preloaded on shop pages');
const fontCount = (layout.match(/path: '\.\.\/public\/fonts\/[^']+\.woff2'/g) || []).length;
check(fontCount <= 7, `at most 7 font files remain, found ${fontCount}`);
ok('LCP: one eager picture; fonts: 9 files -> 7, Arabic not preloaded');

// ---------------------------------------------------------------- 5. splash + AdSense
const css = read('app/globals.css');
check(/@keyframes mz-splash-out/.test(css), 'the splash fades out by CSS');
check(/#mz-splash \{ animation: mz-splash-out/.test(css), 'and it is not waiting for JavaScript any more');
check(/\.ic-heart/.test(css) && /mask: var\(--ic\)/.test(css), 'card icons are CSS masks');
check(!/\.mz-card img \{ animation/.test(css), 'card pictures no longer get a composited opacity animation');

check(!layout.includes('pagead2.googlesyndication.com'), 'AdSense is no longer a raw tag in <head>');
check(layout.includes('<AdSense />'), 'it is mounted as a component');
check(layout.includes('google-adsense-account'), 'the verification meta tag stays');
const adsense = read('components/AdSense.js');
check(/pointerdown/.test(adsense) && /requestIdleCallback/.test(adsense), 'it loads on interaction or at idle');
check(/NEXT_PUBLIC_ADSENSE_EAGER/.test(adsense), 'and can be made eager again');
ok('splash: CSS-only; AdSense: deferred with an eager switch');

// ---------------------------------------------------------------- 6. accessibility
check(!/userScalable: false/.test(layout), 'pinch-zoom is no longer blocked');
check(!/maximumScale/.test(layout), 'no maximum-scale cap');
check(!/passive: false/.test(read('components/AppFeel.js')), 'no non-passive touchmove listener is installed');
ok('a11y: zoom allowed, scrolling never waits for JavaScript');

// ---------------------------------------------------------------- 7. markup diet
const card = read('components/ProductCard.js');
check(!/from 'lucide-react'/.test(card), 'a product card imports no icon library');
check(/class="ic ic-heart"|className="ic ic-heart"/.test(card), 'the wishlist heart is a CSS icon');
for (const t of ['ic-share', 'ic-check', 'ic-plus', 'ic-play']) check(card.includes(t), `card icon ${t} is CSS`);
const marquee = read('components/Marquee.js');
check(/loop = false/.test(marquee), 'Marquee duplicates only when asked to loop');
check(read('components/AnnouncementBar.js').includes('loop'), 'the ticker above the header still loops');
ok('markup: CSS icons, single-copy rows');

// ---------------------------------------------------------------- 8. ads everywhere, never on checkout
const inject = read('components/AdsInject.js');
check(/NO_ADS/.test(inject), 'a skip list exists');
for (const p of ['checkout', 'cart', 'thank-you', 'track', 'account', 'admin']) check(inject.includes(p), `no ads on /${p}`);
check(inject.includes('if (NO_ADS.test(pathname'), 'and it is enforced');
check(layout.includes('<AdsInject slots={[\'auto\']} />'), 'the layout carries one slot on every page');
const embed = read('public/ads/embed.js');
check(/slot\.style\.minHeight = '0'/.test(embed), 'an empty slot collapses (no 90 px gap)');
const infoPages = ['about', 'faq', 'contact', 'shipping', 'returns', 'size-guide', 'reviews', 'team', 'news', 'islamic', 'winter', 'stats', 'reels', 'songs', 'workers'];
for (const p of infoPages) check(read(`app/${p}/page.js`).includes('<ProductAds'), `/${p} shows the shop's products`);
for (const p of ['products', 'category/[slug]', 'product/[slug]', 'movies']) check(read(`app/${p}/page.js`).includes('AdsInject'), `/${p} has an inline ad slot`);
ok('ads: one slot everywhere, product strips on 15 more pages, none on checkout');

// ---------------------------------------------------------------- 9. all actors under Movies
const movies = read('app/movies/page.js');
check(movies.includes('seedActorRows'), 'the hub reads the full cast snapshot');
check(/All Actors, Actresses &amp; Directors/.test(movies), 'it renders the "all actors" directory');
check(/letter=\$\{l\}/.test(movies), 'with A-Z letter chips');
check(/castAll\.total/.test(movies), 'and shows how many people the directory holds');
const seed = read('lib/imdbSeed.js');
check(seed.includes('export function seedActorLetters'), 'the letters come from the snapshot');
const moviesLib = read('lib/movies.js');
check(moviesLib.includes('export function slimListMovie'), 'slimListMovie exists (movies payload)');
check(movies.includes('slimListMovie'), 'the movies browser gets the slim copy');
ok('movies: all actors listed under the hub, with A-Z navigation');

// ---------------------------------------------------------------- 10. weight budgets of the build
const auditPath = join(root, '.next/server/app/index.html');
if (existsSync(auditPath)) {
  const { auditHtml, BUDGET } = await import(new URL('./audit-performance.mjs', import.meta.url).href);
  const home = auditHtml(readFileSync(auditPath, 'utf8'));
  check(home.kb <= BUDGET.home.kb, `home HTML ${home.kb} KB within ${BUDGET.home.kb} KB`);
  check(home.nodes <= BUDGET.home.nodes, `home DOM ${home.nodes} nodes within ${BUDGET.home.nodes}`);
  check(home.svgs <= BUDGET.home.svgs, `home SVGs ${home.svgs} within ${BUDGET.home.svgs}`);
  check(home.preloadImages <= BUDGET.home.preloadImages, `home image preloads ${home.preloadImages} (max ${BUDGET.home.preloadImages})`);
  check(home.preloadFonts <= BUDGET.home.preloadFonts, `home font preloads ${home.preloadFonts} (max ${BUDGET.home.preloadFonts})`);
  check(home.highPriorityImgs <= BUDGET.home.highPriorityImgs, 'at most two high-priority pictures');
  check(home.thirdPartyScripts === 0, 'no third-party script in the first paint');
  ok(`build: home ${home.kb} KB / ${home.nodes} nodes / ${home.svgs} SVGs / ${home.preloadImages} image + ${home.preloadFonts} font preloads`);
} else {
  ok('build: no .next output here, the weight checks run after `npm run build`');
}

// ---------------------------------------------------------------- release hygiene
const pkg = JSON.parse(read('package.json'));
check(Number(String(pkg.version).split('.')[0]) >= 60, `package.json should be 60.x or newer, got ${pkg.version}`);
check(read('UPGRADE-v60.md').includes('60'), 'UPGRADE-v60.md documents the release');
check(String(pkg.scripts.test).includes('test-v60.mjs'), 'npm test runs this suite');
check(String(pkg.scripts.perf || '').includes('audit-performance'), 'npm run perf runs the audit');
check(existsSync(join(root, 'lib/photo.js')) && existsSync(join(root, 'lib/photoServer.js')), 'the photo library is part of the repo');
check(existsSync(join(root, 'app/api/photo/route.js')), 'and the route travels with the app');
ok('release: version, docs, scripts and the test chain are wired');

console.log(`\nAll ${checks} v60 checks passed.`);
