/**
 * Mizanora v62 — ZERO-ORIGIN / HOBBY FREE-TIER BUDGET.
 *
 * Why this suite exists
 * ---------------------
 * v60 fixed relayed media, v61 fixed ISR writes. The free allowance STILL disappeared in a day,
 * because the remaining cost grew with the number of VISITORS, not with the number of pages:
 *
 *   middleware on every request      -> 1 Function invocation + a full HTML origin transfer / view
 *   /api/telemetry page + 60 s beat -> 1 invocation / page, then 1 / minute / open tab
 *   /api/analytics/collect          -> 1 invocation / page (and / SPA route change)
 *   /api/ads/embed.js              -> 1 invocation / page for a file that was already static
 *   /api/ads/serve (no-store)       -> 1 invocation / ad slot / page
 *   /fonts, /brand, /ads, /icons   -> no `s-maxage` at all, so repeated origin transfers
 *   sitemaps with lastmod = today   -> constant crawler churn and an unusable CDN cache
 *
 * v62 removes public traffic from the Function path. This suite pins those rules OFFLINE: no
 * network, no Firebase, no Vercel account needed. Run: node scripts/test-v62.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '');
let checks = 0;
const ok = (m) => { checks += 1; console.log(`ok    ${m}`); };
const check = (cond, msg) => { assert.ok(cond, msg); checks += 1; };

const imp = (p, tag) => import(`${pathToFileURL(join(root, p)).href}?v62=${tag}`);

// ------------------------------------------------------------------ 1. middleware allowlist
const mw = read('middleware.js');
check(/export const config = \{/.test(mw) && /matcher: \[/.test(mw), 'middleware still declares a matcher');
// A catch-all matcher is exactly the bug. Anything that matches "all pages" is forbidden.
check(!/'\/\(\(\?!_next\//.test(mw), 'the old "everything except static" catch-all matcher is gone');
check(!/matcher:\s*\[\s*'\/:path\*'/.test(mw) && !/'\/\(\.\*\)'/.test(mw), 'no catch-all /:path* matcher');
for (const route of ['/admin/:path*', '/api/admin/:path*', '/api/orders', '/api/telemetry', '/api/analytics/collect', '/api/revalidate']) {
  check(mw.includes(`'${route}'`), `middleware still protects the action route ${route}`);
}
check(/ALWAYS_SKIP/.test(mw) && /_next\//.test(mw) && /icons\//.test(mw), 'static folders are skipped defensively too');
check(/staticPath/.test(mw), 'file extensions never reach the blocklist');
// Public read-only paths must NOT appear as matcher entries.
for (const route of ['/api/search', '/api/tv/p', '/api/img', '/api/ads/serve', '/sitemaps/:path*']) {
  check(!mw.includes(`'${route}'`), `${route} is read-only public traffic and must not run middleware`);
}
ok('middleware is an allowlist: zero invocations for public page views');

// ------------------------------------------------------------------ 2. beacon budget (runtime)
function fakeWindow({ vid = 'visitor-abcdef', noTrack = false, dnt = '0', ua = 'Mozilla/5.0 Chrome/120' } = {}) {
  const local = new Map([['mz_vid', vid], ...(noTrack ? [['mz_notrack', '1']] : [])]);
  const session = new Map();
  global.window = {
    localStorage: { getItem: (k) => local.has(k) ? local.get(k) : null, setItem: (k, v) => local.set(k, String(v)) },
    sessionStorage: { getItem: (k) => session.has(k) ? session.get(k) : null, setItem: (k, v) => session.set(k, String(v)) },
    navigator: { userAgent: ua, doNotTrack: dnt, webdriver: false },
  };
  return { local, session };
}

// Default: ~1% sample, weight 100.
delete process.env.NEXT_PUBLIC_TRACK_SAMPLE;
const Default = await imp('lib/beaconBudget.js', 'default');
check(Default.SAMPLE_RATE === 0.01, 'the default sample is 1% (no env var needed)');
check(Default.BEACON_WEIGHT === 100, 'one sampled hit stands for 100 real visits');
check(Default.serverWeight() === 100, 'the server derives the same weight itself');
fakeWindow({ vid: 'plain-visitor-1' });
// Statistical but impossible to fake: with 300 distinct ids, ALL of them being in a 1% sample has
// probability 0.01^300. At least one must be excluded.
let sampled = 0;
for (let i = 0; i < 300; i++) { fakeWindow({ vid: `visitor-${i}` }); if (Default.beaconSelected()) sampled++; }
check(sampled < 30, `only ~1% of visitors are sampled (got ${sampled}/300)`);
ok('default tracking is a deterministic 1% sample, not one beacon per visitor');

// Full fidelity mode.
process.env.NEXT_PUBLIC_TRACK_SAMPLE = '1';
const Full = await imp('lib/beaconBudget.js', 'full');
check(Full.BEACON_WEIGHT === 1 && Full.serverWeight() === 1, 'SAMPLE=1 means exact, unscaled counts');
fakeWindow({ vid: 'exact-visitor' });
check(Full.beaconSelected() === true, 'SAMPLE=1 selects every real visitor');
const firsts = [];
for (let i = 0; i < Full.BEACON_CAPS.page + 2; i++) firsts.push(Full.takeBeacon('page'));
check(firsts.slice(0, Full.BEACON_CAPS.page).every((w) => w === 1), 'each allowed page beacon carries the weight');
check(firsts.slice(Full.BEACON_CAPS.page).every((w) => w === 0), 'a tab cannot exceed its page-beacon cap');
check(Full.takeBeacon('geo') === 1, 'the geo beacon has its own budget');
fakeWindow({ vid: 'bot-visitor', ua: 'Googlebot/2.1 crawler' });
check(Full.beaconSelected() === false && Full.takeBeacon('page') === 0, 'bots never send beacons');
fakeWindow({ vid: 'opted-out', noTrack: true });
check(Full.takeBeacon('page') === 0, 'mz_notrack opts a visitor out');
fakeWindow({ vid: 'dnt-visitor', dnt: '1' });
check(Full.takeBeacon('page') === 0, 'Do Not Track opts a visitor out');
ok('beacon caps, bot filtering and opt-outs hold at runtime');

// Absolute-zero mode.
process.env.NEXT_PUBLIC_TRACK_SAMPLE = '0';
const Off = await imp('lib/beaconBudget.js', 'off');
check(Off.BEACON_WEIGHT === 0, 'SAMPLE=0 disables beacons completely');
fakeWindow({ vid: 'off-visitor' });
check(Off.takeBeacon('page') === 0 && Off.takeBeacon('geo') === 0 && Off.beaconSelected() === false,
  'SAMPLE=0 makes zero network requests from tracking');
check(Off.serverWeight() === 1, 'server counters stay sane if an old cached page still posts');
delete process.env.NEXT_PUBLIC_TRACK_SAMPLE;
delete global.window;
ok('NEXT_PUBLIC_TRACK_SAMPLE=0 is a real hard off switch');

// ------------------------------------------------------------------ 3. clients and servers agree
const track = read('lib/track.js');
check(track.includes('takeBeacon') && track.includes('BEACON_WEIGHT'), 'lib/track.js goes through the budget');
const beacon = read('components/AnalyticsBeacon.js');
check(beacon.includes("takeBeacon('geo')") && beacon.includes('BEACON_WEIGHT'), 'the geo beacon is once per sampled session');
const tracker = read('components/Tracker.js');
check(/setInterval\([^\n]*120000\)/.test(tracker) && !/setInterval\([^\n]*60000\)/.test(tracker), 'the heartbeat is 2 min, not 60 s');

const telemetry = read('app/api/telemetry/route.js');
check(telemetry.includes("import { serverWeight }") && telemetry.includes('const weight = serverWeight()'),
  'the telemetry server derives the weight (never trusts the client)');
check(/\[`d\/\$\{day\}\/views`, weight\]/.test(telemetry), 'daily views are scaled by the sample weight');
check(telemetry.includes('w: weight'), 'presence rows carry the weight for live-user counts');
const collect = read('app/api/analytics/collect/route.js');
check(collect.includes('serverWeight') && collect.includes('weight'), 'the analytics beacon is scaled too');
const analytics = read('lib/analyticsServer.js');
check(/recordHit\(\{ headers, body = \{\}, weight = 1 \}\)/.test(analytics), 'recordHit accepts a clamped weight');
check(/bump\(`an\/v\/\$\{day\}`, w\)/.test(analytics), 'the views counter uses the weight');
check(/Object\.values\(s\.val\(\) \|\| \{\}\)\.reduce/.test(analytics), 'unique visitors sum weights (old `true` markers still count as 1)');
check(/x\.w/.test(read('app/api/stats/route.js')) && /r\.w/.test(read('app/api/admin/analytics/route.js')),
  'public stats and the admin dashboard show full-scale live users');
ok('client beacons, server counters and both dashboards stay consistent');

// ------------------------------------------------------------------ 4. static assets, not Functions
const cfg = read('next.config.js');
check(cfg.includes('s-maxage=31536000'), 'a one-year edge cache exists for static assets');
for (const src of ['/icons/:path*', '/img/:path*', '/fonts/:path*', '/brand/:path*', '/ads/:path*']) {
  check(cfg.includes(`source: '${src}', headers: EDGE_YEAR`), `${src} is a CDN-cached static asset`);
}
check(cfg.includes("'/sitemap-index.xml':") && cfg.includes("'/sitemap.xml':"), 'the sitemap routes still ship the data files their Functions read');
const inject = read('components/AdsInject.js');
check(inject.includes("'/ads/embed.js?key=self'") && !inject.includes("s.src = '/api/ads/embed.js?key=self'"),
  'the shop loads the STATIC ads embed script, not a Function');
check(existsSync(join(root, 'public/ads/embed.js')), 'public/ads/embed.js exists');
check(/s-maxage=31536000/.test(read('app/api/ads/embed.js/route.js')), 'the third-party embed route is edge-cached');
const serve = read('app/api/ads/serve/route.js');
check(serve.includes('s-maxage=300') && serve.includes("key === 'self'"), 'self ad-serve answers are edge-cached');
check(/s-maxage=31536000/.test(read('app/api/indexnow-key/route.js')), 'the IndexNow verification file is edge-cached');
check(/s-maxage/.test(read('app/api/stats/route.js')) && /s-maxage/.test(read('app/api/for-you/route.js')),
  'the two automatic polling APIs remain edge-cached');
check(read('lib/refClient.js').includes('captureInFlight'), 'duplicate worker-price requests are de-duplicated');
ok('no automatic per-view Function remains on the public path');

// ------------------------------------------------------------------ 5. stable sitemaps, fewer deploys
const sm = read('app/sitemaps/[file]/route.js');
const smIndex = read('app/sitemap-index.xml/route.js');
check(sm.includes('sitemapLastmod()') && smIndex.includes('sitemapLastmod()'), 'both sitemap routes use a stable data date');
check(!/const today = new Date\(\)/.test(sm) && !/const now = new Date\(\)/.test(smIndex), 'no "today" lastmod churn');
check(sm.includes('s-maxage=604800') && smIndex.includes('s-maxage=604800'), 'sitemap bodies stay on the CDN for a week');
check(!/max-age=0, s-maxage=21600/.test(sm) && !/max-age=0, s-maxage=21600/.test(smIndex), 'the six-hour regeneration loop is gone');
check(existsSync(join(root, 'data/sitemap-version.txt')), 'the data version file exists');
check(read('.github/workflows/imdb-ids.yml').includes('data/sitemap-version.txt'), 'the weekly refresh bumps the data version');
const vercel = JSON.parse(read('vercel.json'));
check(vercel.ignoreCommand === 'node scripts/vercel-ignore.mjs', 'Vercel skips doc/data-only rebuilds');
check(existsSync(join(root, 'scripts/vercel-ignore.mjs')), 'the ignore script exists');
check(Array.isArray(vercel.crons) && vercel.crons.length <= 1, 'at most one cron job (Hobby allows two/day)');
ok('sitemaps stop churning and docs-only pushes stop deploying');

// ------------------------------------------------------------------ 6. no regressions
// v61's ISR budget stays exactly as it was: this release removes O(visitors) costs, it does not
// re-introduce fast revalidation or drop the prerender caps.
const livePages = read('app/page.js');
check(/export const revalidate = 86400/.test(livePages), 'live-data pages still revalidate once a day (v61 rule)');
check(!/export const revalidate/.test(read('app/blog/page.js')), 'repo-only pages are still fully static');
const policy = read('lib/cachePolicy.js');
check(policy.includes('v62') && policy.includes('Fast Data Transfer'), 'the remaining hard limit is documented honestly');
check(read('.env.example').includes('NEXT_PUBLIC_TRACK_SAMPLE'), 'the new switch is documented in .env.example');
check(read('package.json').includes('"test:v62"') && read('package.json').includes('npm run test:v62'), 'the suite runs in CI');
check(existsSync(join(root, 'UPGRADE-v62.md')), 'UPGRADE-v62.md documents the release');
ok('v60/v61 rules and documentation are intact');

console.log(`\nAll v62 zero-origin tests passed (${checks} checks).`);
