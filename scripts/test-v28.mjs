// v28 tests: the new Live TV guide/filter rules, local HLS loading, the /search crash and redirect fixes,
// Live TV performance wiring, and the small app-wide cleanups. Run: node scripts/test-v28.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const imp = (f) => import(pathToFileURL(path.join(root, f)).href);
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const ok = (m) => console.log(`ok    ${m}`);

const U = await imp('lib/liveTvUi.js');
const T = await imp('lib/liveTv.js');
const S = await imp('lib/siteSearch.js');
const Q = await imp('lib/quran.js');
const H = await imp('lib/hadith.js');

// ---- Live TV guide rules -------------------------------------------------------------------------------------------
const channels = [
  { name: 'Geo News', url: 'https://a.example/1.m3u8', group: 'News', off: false },
  { name: 'Geo Kids', url: 'https://a.example/2.m3u8', group: 'News', off: false },
  { name: 'ARY', url: 'https://a.example/3.m3u8', group: 'Sports', off: true },
  { name: 'سماء', url: 'https://a.example/4.m3u8', group: 'Other', off: false },
];
assert.deepEqual(U.filterChannels(channels).map((c) => c.name), ['Geo News', 'Geo Kids', 'سماء']);
assert.deepEqual(U.filterChannels(channels, { group: 'News' }).map((c) => c.name), ['Geo News', 'Geo Kids']);
assert.deepEqual(U.filterChannels(channels, { query: 'geo' }).map((c) => c.name), ['Geo News', 'Geo Kids']);
assert.deepEqual(U.filterChannels(channels, { query: 'سماء' }).map((c) => c.name), ['سماء']);
assert.deepEqual(U.filterChannels(channels, { group: 'Favourites', favs: ['https://a.example/4.m3u8'] }).map((c) => c.name), ['سماء']);
assert.deepEqual(U.filterChannels(channels, { group: 'Recent', recent: ['https://a.example/2.m3u8', 'https://a.example/4.m3u8'] }).map((c) => c.name), ['Geo Kids', 'سماء']);
ok('live tv: guide filters by group, search, favourites and recents, and hides off channels');

assert.deepEqual(U.qualityLevel([1, 2, 3, 4], 'save'), 0);
assert.deepEqual(U.qualityLevel([1, 2, 3, 4], 'balanced'), 1);
assert.deepEqual(U.qualityLevel([1, 2, 3, 4], 'high'), 3);
assert.equal(U.qualityLevel([1, 2], 'auto'), -1);
assert.equal(U.qualityLevel([], 'high'), -1);
assert.equal(U.tvClock(new Date(Date.UTC(2026, 9, 24, 19, 30))), '00:30');
assert.equal(U.tvStatusLabel('playing', true, 'hls'), 'BUFFERING');
assert.equal(U.tvStatusLabel('failed', false, 'hls'), 'NO SIGNAL');
assert.equal(U.tvStatusLabel('youtube', false, 'youtube'), 'LIVE');
assert.equal(U.streamOrigin('https://cdn.example/a.m3u8'), 'https://cdn.example');
assert.equal(U.streamOrigin('bad url'), '');
ok('live tv: quality levels, Pakistan clock, status labels and stream preconnects');

// ---- the /search crash and redirect --------------------------------------------------------------------------------
assert.equal(Q.SURAHS.length, 114);
assert.equal(typeof Q.SURAHS[0].name, 'string');
assert.equal(typeof Q.SURAHS[0].ayat, 'number');
assert.equal(Q.SURAHS.reduce((n, s) => n + s.ayat, 0), 6236);
const search = S.siteSearch('fatihah', { surahs: Q.SURAHS });
assert.equal(search.quran.length, 1);
assert.equal(search.quran[0].name, 'Al-Fatihah');
const bookSearch = S.siteSearch('bukhari', { books: H.BOOKS });
assert.equal(bookSearch.hadith.length, 1);
assert.deepEqual(bookSearch.hadith[0], ['bukhari', 'Sahih al-Bukhari', 'صحيح البخاري']);
assert.equal(S.siteSearch('bukhari', { books: H.BOOKS.map((b) => [b.key, b.name, '']) }).hadith.length, 1);
ok('site search: SURAHS is an array of objects and finds Al-Fatihah');
ok('site search: object-shaped hadith books are normalised to renderer tuples');
const searchPage = read('app/search/page.js');
assert.ok(!/SURAHS\.map\(\(\[name\], i\)/.test(searchPage));
assert.ok(/surahs: SURAHS/.test(searchPage));
assert.ok(/<Suspense fallback={null}><ProductAds/.test(searchPage));
const nextConfig = read('next.config.js');
assert.ok(!/['\"]search['\"], destination: '\/products'/.test(nextConfig.replace(/\s+/g, ' ')), 'next.config.js must not redirect /search to /products');
assert.ok(!/'search'\]/.test(nextConfig.replace(/\s+/g, ' ')));
ok('search: no tuple destructuring, no redirect, product strip streams');

// ---- player + server wiring -----------------------------------------------------------
const player = read('components/LiveTvPlayer.js');
assert.ok(/import\('hls\.js\/light'\)/.test(player));
assert.ok(!/cdnjs\.cloudflare\.com/.test(player));
assert.ok(/setRelayIndex\(idx\)/.test(player) && /relayed/.test(player));
assert.ok(/TV_QUALITY/.test(player) && /qualityLevel/.test(player));
assert.ok(/jumpToLive/.test(player) && /mztv-live-edge/.test(player));
assert.ok(/useDeferredValue/.test(player) && /filterChannels/.test(player));
assert.ok(/MZ_TV_DEMO|TV_DEMO/.test(read('lib/liveTvServer.js')) && /TV_DEMO/.test(read('lib/liveTv.js')));
ok('player: local HLS, relay fallback, quality, live edge, deferred guide and demo mode');

const liveTvServer = read('lib/liveTvServer.js');
assert.ok(/Promise\.all\(unique\.map/.test(liveTvServer));
assert.ok(/mz-livetv-config-v2-/.test(liveTvServer));
const channelPage = read('app/live/[slug]/page.js');
assert.ok(/dynamicParams = true/.test(channelPage) && /generateStaticParams/.test(channelPage) && /<Suspense fallback={null}><ProductAds/.test(channelPage));
const livePage = read('app/live/page.js');
assert.ok(/<Suspense fallback={null}><ProductAds/.test(livePage) && /list\.slice\(0, 120\)/.test(livePage));
const liveChannelPage = read('app/live-channel/page.js');
assert.ok(!/<main/.test(liveChannelPage) && /export const revalidate = 3600/.test(liveChannelPage));
const liveChannel = read('components/LiveChannel.js');
assert.ok(!/<main className="mzc-stage"/.test(liveChannel) && /<section className="mzc-stage"/.test(liveChannel));
ok('live tv: parallel ad fetch, static channel pages, static Islamic channel shell, no nested main');

const relay = read('lib/tvProxy.js');
assert.ok(/AbortSignal\.any/.test(relay) && /timeoutSignal/.test(relay));
assert.ok(/signal: req\.signal/.test(read('app/api/tv/p/route.js')));
const adminTv = read('app/admin/tv/page.js');
// v38: this used to match the exact wording of the message. The admin page was rewritten and
// the behaviour is what matters: dedupe by stream link, and never add past MAX_CHANNELS.
assert.ok(/MAX_CHANNELS - cfg\.channels\.length/.test(adminTv) && /have\.has\(c\.url\)/.test(adminTv) && /unique\.slice\(0, room\)/.test(adminTv));
ok('relay: aborts upstream with the viewer request; admin import deduplicates and respects the limit');

// ---- app-wide cleanups --------------------------------------------------------------
assert.ok(!/\/home\/claude\/\.npm-global/.test(read('scripts/check.js')) && !/\/home\/claude\/\.npm-global/.test(read('scripts/typecheck.js')));
assert.ok(/requestIdleCallback/.test(read('components/PwaRegister.js')) && /cancelIdleCallback/.test(read('components/PwaRegister.js')));
assert.ok(/const VERSION = 'mz-v5';/.test(read('public/sw.js')));
const packageJson = JSON.parse(read('package.json'));
// v36: this used to hard-code the three versions that existed when v28 shipped, so bumping the
// package broke an unrelated test. The point of the check is "the package is wired up", so any
// version from v28 onwards is fine (semver major, minor and patch are all accepted).
{
  const [major] = String(packageJson.version).split('.').map(Number);
  assert.ok(Number.isFinite(major) && major >= 28, `package version ${packageJson.version} is v28 or later`);
}
assert.ok(packageJson.dependencies['hls.js']);
assert.ok(packageJson.scripts.test.includes('scripts/test-v28.mjs'));
ok('cleanup: portable TypeScript check, service-worker timer cleanup, v28 package wiring');

console.log('\nAll v28 tests passed.');
