/*
 * Mizanora v46 tests — poora IPTV system: public movies/series library + detail pages,
 * TV guide + apps + status + recharge pages, premium unlock animation, 7-din catch-up
 * (timeshift), sitemap rewiring, aur naye IPTV blog guides.
 *
 * Run: node scripts/test-v46.mjs   (also wired into `npm test`)
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '');
const has = (p, needle) => read(p).includes(needle);

let pass = 0;
const fails = [];
const ok = (name, cond) => { if (cond) { pass++; console.log(`ok - ${name}`); } else { fails.push(name); console.log(`FAIL - ${name}`); } };

const cu = await import('../lib/iptvCatchup.js');

// ---------------------------------------------------------------- 1. catch-up rules
ok('catchup: no channel = 0 days', cu.archiveDaysFor(null) === 0);
ok('catchup: plain channel = 0 days', cu.archiveDaysFor({ id: '1' }) === 0);
ok('catchup: numeric archive kept', cu.archiveDaysFor({ archive: 3 }) === 3);
ok('catchup: string archive parsed', cu.archiveDaysFor({ archive: '7' }) === 7);
ok('catchup: boolean archive = full window', cu.archiveDaysFor({ archive: true }) === cu.CATCHUP_MAX_DAYS);
ok('catchup: >7 days is clamped', cu.archiveDaysFor({ archive: 30 }) === 7);
ok('catchup: negrows = 0', cu.archiveDaysFor({ archive: -2 }) === 0);
ok('catchup: hasCatchup helper', cu.hasCatchup({ catchup: 5 }) === true && cu.hasCatchup({}) === false);

const NOW = Date.parse('2026-11-02T12:00:00Z');
ok('start: xtream stamp parses', cu.parseStart('2026-11-02:10-30') === Date.UTC(2026, 10, 2, 10, 30));
ok('start: iso with seconds parses', cu.parseStart('2026-11-02 10:30:15') === Date.UTC(2026, 10, 2, 10, 30, 15));
ok('start: epoch seconds parses', cu.parseStart('1793700000') === 1793700000000);
ok('start: epoch millis parses', cu.parseStart('1793700000000') === 1793700000000);
ok('start: garbage is 0', cu.parseStart('kal') === 0 && cu.parseStart('') === 0);

ok('window: yesterday is fine', cu.catchupWindow('2026-11-01:20-00', { now: NOW, days: 7 }).ok === true);
const winNow = cu.catchupWindow('2026-11-02 10:00', { now: NOW, days: 7, minutes: 60 });
ok('window: start + minutes resolved', winNow.ok && winNow.start === Date.UTC(2026, 10, 2, 10, 0) && winNow.end - winNow.start === 3600000);
ok('window: future rejected', cu.catchupWindow('2026-11-03:10-00', { now: NOW }).ok === false);
ok('window: 8 days old rejected', cu.catchupWindow('2026-10-25:10-00', { now: NOW, days: 7 }).ok === false);
ok('window: 7 days old accepted', cu.catchupWindow('2026-10-26:12-30', { now: NOW, days: 7 }).ok === true);
ok('window: minutes are clamped to 180', cu.catchupWindow('2026-11-02:08-00', { now: NOW, minutes: 600 }).minutes <= 180);
ok('window: end never crosses now', (() => { const w = cu.catchupWindow('2026-11-02:11-50', { now: NOW, minutes: 60 }); return w.ok && w.end <= NOW; })());
ok('window: bad start explains itself', typeof cu.catchupWindow('xyz', { now: NOW }).error === 'string');

const t1 = cu.timeshiftUrl('https://up.example/live/geo.m3u8', Date.UTC(2026, 10, 2, 10, 0), Date.UTC(2026, 10, 2, 11, 0));
ok('timeshift: utc/lutc appended', t1.includes('?utc=') && t1.includes('&lutc='));
ok('timeshift: existing query continued', cu.timeshiftUrl('https://up.example/x.m3u8?token=1', NOW - 3600000, NOW).includes('?token=1&utc='));
ok('timeshift: placeholders filled', cu.timeshiftUrl('https://up/{start}/{end}/{dur}.m3u8', 1793700000000, 1793703600000) === 'https://up/1793700000000/1793703600000/60.m3u8');
ok('timeshift: {utc} in seconds', cu.timeshiftUrl('https://up/{utc}-{lutc}.ts', 1793700000000, 1793703600000) === 'https://up/1793700000-1793703600.ts');
ok('timeshift: non http rejected', cu.timeshiftUrl('rtmp://x', NOW - 1000, NOW) === '' && cu.timeshiftUrl('', NOW - 1000, NOW) === '');
ok('timeshift: reversed window rejected', cu.timeshiftUrl('https://up/a.m3u8', NOW, NOW - 1000) === '');
ok('label: reads well', cu.catchupLabel(7).includes('7') && cu.catchupLabel(0).toLowerCase().includes('no'));

// ---------------------------------------------------------------- 2. timeshift gateway route
const tw = read('lib/gateway/timeshift.js');
ok('route: timeshift core exists', tw.length > 600 && has('app/api/gw/timeshift/route.js', 'handleTimeshift'));
ok('route: verifies the line', tw.includes('verifyLine'));
ok('route: device limit enforced', tw.includes('checkDevice'));
ok('route: refuses channels without archive', tw.includes('archiveDaysFor') && tw.includes('503'));
ok('route: proxies through the sealed helper', tw.includes('proxyMedia'));
ok('route: tracks the event', tw.includes('timeshift_start'));
ok('route: never prints the upstream url', !tw.includes('console.log'));
ok('proxyMedia is exported from handleStream', has('lib/gateway/handleStream.js', 'export async function proxyMedia'));
ok('timeshift path route reads its own segments', has('app/timeshift/[...parts]/route.js', 'handleTimeshift'));
ok('timeshift core is shared', has('lib/gateway/timeshift.js', 'export async function handleTimeshift'));
ok('next.config: streaming/timeshift.php rewrite', has('next.config.js', "'/streaming/timeshift.php'"));
ok('player_api: archive flags per channel', has('app/api/gw/player/route.js', 'tv_archive_duration: archiveDaysFor(c)'));
ok('player_api: epg id shared with xmltv', has('app/api/gw/player/route.js', 'epg_channel_id: c.epg'));
ok('stalker: archive flags kept', has('app/api/gw/portal/route.js', 'allow_timeshift: archiveDaysFor(c)'));
ok('guide page: archive badge is fed', has('app/iptv/guide/page.js', 'archive: archiveDaysFor(c)'));
ok('guide grid: badge renders', has('components/IptvGuideGrid.js', 'r.archive'));

// ---------------------------------------------------------------- 3. public library + detail pages
ok('library helper exists', has('lib/iptvPublic.js', 'getPublicLibrary'));
ok('library strips stream urls', has('lib/iptvPublic.js', 'const safeMovie') && !read('lib/iptvPublic.js').includes('url:'));
ok('movies page lists the library', has('app/iptv/movies/page.js', 'IptvLibrary'));
ok('series page lists the library', has('app/iptv/series/page.js', 'IptvLibrary'));
ok('library client: search + group + sort', ['Search', 'group', 'rating'].every((t) => has('components/IptvLibrary.js', t)));
const mv = read('app/iptv/movies/[id]/page.js');
ok('movie detail exists', mv.length > 800);
ok('movie detail: Movie schema', mv.includes("'@type': 'Movie'"));
ok('movie detail: imdb link', mv.includes('imdb.com/title'));
ok('movie detail: player cta', mv.includes('/iptv/player'));
ok('movie detail: related shelf', mv.includes('related'));
ok('movie detail: notFound on unknown id', mv.includes('notFound()'));
const sr = read('app/iptv/series/[id]/page.js');
ok('series detail exists', sr.length > 800);
ok('series detail: TVSeries schema', sr.includes("'@type': 'TVSeries'"));
ok('series detail: seasons listed', sr.includes('seasonList'));
ok('series detail: episodes numbered', sr.includes('e.n'));
ok('series detail: trial cta', sr.includes('/iptv/start'));

// ---------------------------------------------------------------- 4. every kind of IPTV page
const pages = [
  ['app/iptv/page.js', 'landing'],
  ['app/iptv/channels/page.js', 'channels'],
  ['app/iptv/player/page.js', 'player'],
  ['app/iptv/movies/page.js', 'movies'],
  ['app/iptv/series/page.js', 'series'],
  ['app/iptv/movies/[id]/page.js', 'movie detail'],
  ['app/iptv/series/[id]/page.js', 'series detail'],
  ['app/iptv/guide/page.js', 'guide'],
  ['app/iptv/apps/page.js', 'apps'],
  ['app/iptv/status/page.js', 'status'],
  ['app/iptv/recharge/page.js', 'recharge'],
  ['app/iptv/reseller/page.js', 'reseller'],
  ['app/iptv/trial/page.js', 'trial'],
  ['app/iptv/start/page.js', 'start'],
];
for (const [p, name] of pages) ok(`page exists: ${name}`, read(p).length > 400);
ok('guide page: schedulem rows passed to grid', has('app/iptv/guide/page.js', 'IptvGuideGrid'));
ok('guide page: now/next used', has('app/iptv/guide/page.js', 'nowNext'));
ok('guide page: catch-up explained', has('app/iptv/guide/page.js', '7-din catch-up'));
ok('apps page: xtream + stalker + m3u covered', ['Xtream', 'Stalker', 'M3U'].every((t) => has('app/iptv/apps/page.js', t)));
ok('apps page: faq schema', has('app/iptv/apps/page.js', 'faqJsonLd'));
ok('status page: public stats', has('app/iptv/status/page.js', 'getPublicStats'));
ok('status page: no admin secret leaked', !has('app/iptv/status/page.js', 'IPTV_GW_SECRET'));
ok('recharge page: uses the shared rules', has('app/iptv/recharge/page.js', 'IptvRecharge'));
const rc = read('components/IptvRecharge.js');
ok('recharge: plan picker', rc.includes('plans') || rc.includes('PLANS'));
ok('recharge: 1/3/12 months', rc.includes('12'));
ok('recharge: jazzcash copy button', rc.includes('clipboard'));
ok('recharge: whatsapp deep link', rc.includes('wa.me'));
ok('recharge: reseller credit mode', rc.toLowerCase().includes('credit'));
ok('recharge: cap disclosed', rc.includes('IPTV.cap'));
ok('recharge: unlock animation classes', rc.includes('mz-unlock'));
ok('css: unlock keyframes', has('app/globals.css', '@keyframes mzUnlockShine'));
ok('css: reduced motion respected', has('app/globals.css', '.mz-unlock::after, .mz-lock-on'));

// ---------------------------------------------------------------- 5. wiring: landing + sitemap + blogs
const ip = read('app/iptv/page.js');
ok('landing: system nav block', ip.includes('Poora system'));
for (const href of ['/iptv/guide', '/iptv/movies', '/iptv/series', '/iptv/apps', '/iptv/recharge', '/iptv/status']) {
  ok(`landing links ${href}`, ip.includes(href));
}
const sm = read('app/sitemap.js');
for (const p of ['/iptv/guide', '/iptv/movies', '/iptv/series', '/iptv/apps', '/iptv/recharge', '/iptv/status']) {
  ok(`sitemap has ${p}`, sm.includes(`'${p}'`));
}
ok('sitemap: movie details', sm.includes('/iptv/movies/${m.id}'));
ok('sitemap: series details', sm.includes('/iptv/series/${x.id}'));

const posts = [
  ['iptv-browser-player-guide', '/iptv/player'],
  ['iptv-epg-xmltv-guide-pakistan', '/xmltv.php'],
  ['iptv-movies-series-library-guide', '/iptv/movies'],
  ['iptv-7-din-catchup-timeshift', '/timeshift/'],
  ['iptv-ads-vs-ad-free', '/iptv/recharge'],
];
for (const [slug, link] of posts) {
  const body = read(`content/blog/${slug}.md`);
  ok(`blog exists: ${slug}`, body.startsWith('---') && body.includes(`slug: ${slug}`));
  ok(`blog category: ${slug}`, body.includes('category: live-and-reels'));
  ok(`blog links ${link}`, body.includes(link));
  ok(`blog body long enough: ${slug}`, body.split('\n').length > 60);
  ok(`blog front matter complete: ${slug}`, ['title:', 'description:', 'date:', 'tags:'].every((k) => body.includes(k)));
}
ok('landing lists the new guides', ip.includes('/blog/iptv-browser-player-guide') && ip.includes('/blog/iptv-7-din-catchup-timeshift'));

// ---------------------------------------------------------------- 6. version + docs
const pkg = JSON.parse(read('package.json'));
ok('version is 46.0.0', pkg.version === '46.0.0');
ok('test script includes v46', String(pkg.scripts.test).includes('test-v46.mjs'));
ok('upgrade notes v46', read('UPGRADE-v46.md').length > 500);
ok('plan doc mentions v46', has('docs/IPTV-PLAN.md', 'v46'));

console.log(`\nv46: ${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log('\nFAILED:'); for (const f of fails) console.log(' - ' + f); process.exit(1); }
