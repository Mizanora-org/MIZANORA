/**
 * Mizanora v59 — release-date, sitemap-coverage and songs-in-search checks.
 *
 * What this suite proves (offline, no network needed):
 *   1. the calendar now reads REAL dates from Cinemeta meta payloads (and never invents one)
 *   2. enrichment fills releaseDate/status/year and honours its budget + limit
 *   3. the "date TBA" group no longer jumps in front of dated months
 *   4. every actor letter is published in full (no 200-row clamp) and titles without a year
 *      get their own sitemap file, which the index advertises
 *   5. the songs catalogue (songs + singers) is memoised for the per-letter files
 *   6. songs appear in site-wide search with artwork + playback, and the search copy says so
 *
 * Run: node --experimental-loader ./scripts/test-v30-loader.mjs scripts/test-v59.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '');
const ok = (m) => console.log(`ok    ${m}`);
let checks = 0;
const check = (cond, msg) => { assert.ok(cond, msg); checks += 1; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks += 1; };

const Dates = await import(pathToFileURL(join(root, 'lib/releaseDates.js')).href);
const Seed = await import(pathToFileURL(join(root, 'lib/imdbSeed.js')).href);
const Songs = await import(pathToFileURL(join(root, 'lib/songs.js')).href);
const M = await import(pathToFileURL(join(root, 'lib/movies.js')).href);

// ------------------------------------------------------------ 1. reading Cinemeta's meta payload
eq(Dates.dateFromMeta({ released: '2026-12-18T00:00:00.000Z' }), '2026-12-18', 'ISO released is trimmed to YYYY-MM-DD');
eq(Dates.dateFromMeta({ released: '2027-01-01' }), '2027-01-01', 'a plain date passes through');
eq(Dates.dateFromMeta({ released: '', releaseInfo: '2026-07-04' }), '2026-07-04', 'releaseInfo is the fallback');
eq(Dates.dateFromMeta({ releaseInfo: 'Coming soon' }), '', 'prose is NOT a date — nothing is invented');
eq(Dates.dateFromMeta({ released: '0000-00-00' }), '', 'zero dates are rejected');
eq(Dates.dateFromMeta(null), '', 'a missing meta block yields no date');
eq(await Dates.releaseDateFor('not-an-id'), '', 'a non-IMDb id never hits the network');
ok('dates: Cinemeta meta -> exact YYYY-MM-DD, nothing invented');

// ------------------------------------------------------------ 2. enrichment (stubbed fetcher)
const realFetch = globalThis.fetch;
const asked = [];
globalThis.fetch = async (url) => {
  asked.push(String(url));
  const id = String(url).split('/').pop().replace('.json', '');
  const meta = {
    tt90000001: { released: '2027-02-12T00:00:00.000Z' },
    tt90000002: { releaseInfo: '2026-01-05' },
    tt90000003: {}, // Cinemeta has no date for this one
  }[id];
  if (!id.startsWith('tt9000000')) return new Response('{}', { status: 404 });
  return new Response(JSON.stringify({ meta }), { status: 200, headers: { 'content-type': 'application/json' } });
};

try {
  const list = [
    { imdbId: 'tt90000001', year: 2027, status: 'released', releaseDate: '' },
    { imdbId: 'tt90000002', year: 2026, status: 'released', releaseDate: '' },
    { imdbId: 'tt90000003', year: 2026, status: 'upcoming', releaseDate: '' },
    { imdbId: 'tt90000004', year: 1994, status: 'released', releaseDate: '' }, // too old to ask about
    { imdbId: 'tt90000005', year: 2026, status: 'released', releaseDate: '2026-03-01' }, // already dated
  ];
  await Dates.enrichReleaseDates(list, { limit: 50, budgetMs: 5000, concurrency: 3 });
  eq(list[0].releaseDate, '2027-02-12', 'a future date is filled in');
  eq(list[0].status, 'upcoming', 'and flips the status to upcoming');
  eq(list[1].releaseDate, '2026-01-05', 'releaseInfo dates are used too');
  eq(list[1].status, 'released', 'a past date stays released');
  eq(list[2].releaseDate, '', 'no answer -> still empty (honest TBA)');
  eq(list[3].releaseDate, '', 'old titles are not asked about');
  eq(list[4].releaseDate, '2026-03-01', 'an existing exact date is left alone');
  check(asked.length <= 10, `budget/limit respected (${asked.length} lookups)`);
  check(asked.some((u) => u.includes('/movie/tt90000001')), 'Cinemeta meta endpoint is what gets called');

  // limit is a hard cap
  asked.length = 0;
  const many = Array.from({ length: 40 }, (_, i) => ({ imdbId: `tt900001${String(i).padStart(2, '0')}`, year: 2027, status: 'upcoming', releaseDate: '' }));
  await Dates.enrichReleaseDates(many, { limit: 4, budgetMs: 3000, concurrency: 2 });
  check(asked.length <= 8, `limit=4 really caps lookups (${asked.length})`);
  ok('dates: enrichment fills, flips status, respects limit/budget and leaves TBA alone');

  eq(Dates.countUpcoming([{ releaseDate: '2999-01-01' }, { releaseDate: '1999-01-01' }, { releaseDate: '' }]), 1, 'countUpcoming counts only real future dates');
} finally {
  globalThis.fetch = realFetch;
}

const cal = read('app/movies/calendar/page.js');
check(cal.includes('enrichReleaseDates'), 'the calendar page enriches its dates');
check(/limit:\s*200/.test(cal) && /budgetMs:\s*8000/.test(cal), 'with a bounded budget (serverless-safe)');
check(cal.includes('exact dates confirmed'), 'and tells the visitor how many dates are real');

// ------------------------------------------------------------ 3. TBA groups sort last
const build = (movies, refDate = '2026-11-06') => M.buildReleaseCalendar(movies, { refDate });
const groups = build([
  { title: 'Dated', slug: 'a', year: 2026, releaseDate: '2026-12-01', status: 'upcoming' },
  { title: 'Unknown', slug: 'b', year: 2026, releaseDate: '', status: 'upcoming' },
]);
eq(groups.length, 2, 'two groups: the dated month and the TBA year');
check(groups[0].ym === '2026-12', `dated months come first, got ${groups[0].ym}`);
check(groups[1].ym === '2026-00', 'the TBA group is last');
check(groups[1].label.includes('date TBA'), 'and is labelled date TBA');
ok('calendar: real dates render above the "date TBA" bucket');

// ------------------------------------------------------------ 4. sitemap coverage
const route = read('app/sitemaps/[file]/route.js');
check(route.includes('titles-unknown'), 'titles without a year get their own sitemap file');
check(route.includes('seedActorSlugs'), 'actor letter files ask for the whole letter');
check(!/seedActorRows\(\{[^}]*limit:\s*40000/.test(route), 'no code path still asks seedActorRows for 40,000 rows (it clamps at 200)');
const index = read('app/sitemap-index.xml/route.js');
check(index.includes('titles-unknown'), 'the index advertises titles-unknown.xml');
check(index.includes('seedActorLetters'), 'and derives the actor letters from the whole cast snapshot');

const jLetter = Seed.seedActorSlugs({ letter: 'j', minTitles: 3, limit: 40000 });
check(jLetter.length > 200, `letter J is published in full, got ${jLetter.length}`);
eq(jLetter.length, new Set(jLetter).size, 'no duplicate slugs in a letter');
check(jLetter.every((s) => s.startsWith('j')), 'every slug belongs to its letter');
check(Seed.seedActorSlugs({ minTitles: 3 }).length >= 10000, `full cast directory is >10k, got ${Seed.seedActorSlugs({ minTitles: 3 }).length}`);
const letters = Seed.seedActorLetters(3);
eq(letters.length, 26, 'all 26 actor letters exist');
check(letters.includes('x') && letters.includes('q'), 'even the thin letters (q, x) are present');
ok(`sitemap: full cast directory (${Seed.seedCastSize(3).toLocaleString('en-US')} people), every letter, plus titles-unknown`);

// every id in the committed pool must land in exactly one file: its year, or titles-unknown
const pool = read('data/imdb-ids.txt').trim().split('\n').map((line) => line.split('\t'));
check(pool.length > 80000, `the committed id pool is complete, got ${pool.length}`);
const yearOf = (row) => Number(row[2]);
const usableIds = pool.filter((row) => yearOf(row) >= 1870 && yearOf(row) <= 2100);
const unknownIds = pool.filter((row) => !(yearOf(row) >= 1870 && yearOf(row) <= 2100));
eq(usableIds.length + unknownIds.length, pool.length, 'no id falls between the year files and titles-unknown');
eq(unknownIds.length, 2, 'exactly two ids have no usable year');
check(usableIds.some((row) => yearOf(row) < 1900), 'pre-1900 films (tt0000009, 1894) get a year file instead of being dumped in unknown');
check(route.includes('1870'), 'the titles-YEAR route uses the same year floor as the index');
check(index.includes('1870'), 'and so does the index');
ok('sitemap: every committed id is published (year file or titles-unknown)');

const guide = read('app/sitemaps/page.js');
check(guide.includes('titles-unknown.xml'), 'the human sitemap guide lists the new file');
check(guide.includes('seedCastSize'), 'and reports the real cast total');
check(/hasUnknownYear/.test(guide) && /fileCount/.test(guide), 'its file count includes the unknown-year file');

// ------------------------------------------------------------ 5. songs catalogue for sitemaps
const songsServer = read('lib/songsServer.js');
check(songsServer.includes('sitemapCache') && songsServer.includes('SITEMAP_TTL'), 'the songs catalogue is memoised');
check(/export async function getSongsForSitemap/.test(songsServer), 'and still exported under the old name');
check(songsServer.includes('artists: [...seenArtists.values()]'), 'it returns deduped singers as well as songs');
check(songsServer.includes('limit = 900'), 'and aims for ~900 songs');
check(songsServer.includes('Promise.allSettled'), 'a dead mirror cannot sink the whole file');

// a JioSaavn web page URL must never be treated as audio
const parsed = Songs.cleanSong({
  id: 'abcDEF123',
  name: 'Kesariya',
  url: 'https://www.jiosaavn.com/song/kesariya/xyz',
  downloadUrl: [{ quality: '320kbps', link: 'https://aac.saavncdn.com/1/2_320.mp3' }],
  image: 'https://c.saavncdn.com/x.jpg',
  artistMap: { primary_artists: [{ name: 'Arijit Singh' }] },
});
check(parsed && parsed.stream && parsed.stream.includes('aac.saavncdn.com'), 'the audio stream is the CDN file');
check(!String(parsed.stream).includes('jiosaavn.com/song'), 'never the JioSaavn web page');
check(String(parsed.permalink).includes('jiosaavn.com/song'), 'the web page is kept as a permalink');
check((parsed.audioSources || []).every((u) => !String(u).includes('jiosaavn.com/song')), 'and no source points at a web page');
ok('songs: sitemap catalogue memoised, singers included, CDN audio separated from web pages');

// ------------------------------------------------------------ 6. songs in search + song files
const block = read('components/SearchSongsBlock.js');
check(block.includes('useMusic'), 'search results can actually play a song');
check(block.includes('songImageSrc'), 'with proxied artwork');
check(block.includes('Play all'), 'and a play-all queue');
check(block.includes('/songs?q='), 'plus a link to the full songs search');
const searchPage = read('app/search/page.js');
check(searchPage.includes('SearchSongsBlock'), 'the search page mounts the songs block');
check(/songs and singers/.test(searchPage), 'its description mentions songs');
check(/Kesariya/.test(searchPage), 'and its placeholder shows a song example');
const songsRoute = read('app/sitemaps/[file]/route.js');
check(songsRoute.includes('/songs/${sg.slug}'), 'song pages are in the songs sitemaps');
ok('songs: playable in site search, listed in the sitemaps');

// ------------------------------------------------------------ 7. release hygiene
const pkg = JSON.parse(read('package.json'));
check(String(pkg.version).startsWith('59.'), `package.json should be 59.x, got ${pkg.version}`);
check(read('UPGRADE-v59.md').includes('59'), 'UPGRADE-v59.md documents the release');
check(String(pkg.scripts.test).includes('test-v59.mjs'), 'npm test runs this suite');
check(existsSync(join(root, 'lib/releaseDates.js')), 'lib/releaseDates.js is part of the repo');
ok('release: version, docs and the test chain are wired');

console.log(`\nAll ${checks} v59 checks passed.`);
