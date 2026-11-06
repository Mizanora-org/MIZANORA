/*
 * Mizanora v55 tests — "sab kuch kaam kare, chahe internet ho ya na ho".
 *
 * v54 read everything from Cinemeta at request time. In a preview sandbox (no outbound internet) that
 * meant: /movies empty, search empty, calendar empty, songs empty, sitemap nearly empty. v55 fixes it
 * with a committed IMDb snapshot, a working search across films AND series, singer pages, a rebuilt
 * calendar and a documented sitemap set.
 *
 * These tests pin down:
 *   1. the snapshot: cards, search (title/cast/id/series), rows, upcoming, ids
 *   2. the wiring: hub, detail lookup, search API (type filter), calendar year fallback
 *   3. songs: singer slugs + names, artist pages, direct browser fallback, songs sitemap with singers
 *   4. sitemaps: the human guide page, SITEMAPS.md, the index contents and the id file
 *   5. release hygiene: version, docs, test chain
 *
 * Run: node --experimental-loader ./scripts/test-v30-loader.mjs scripts/test-v55.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '');
const ok = (m) => console.log(`ok    ${m}`);
let checks = 0;
const check = (cond, msg) => { assert.ok(cond, msg); checks += 1; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks += 1; };

const Seed = await import(pathToFileURL(join(root, 'lib/imdbSeed.js')).href);
const Songs = await import(pathToFileURL(join(root, 'lib/songs.js')).href);
const M = await import(pathToFileURL(join(root, 'lib/movies.js')).href);

// ---------------------------------------------------------------- 1. the snapshot itself
check(existsSync(join(root, 'data/imdb-seed.json')), 'data/imdb-seed.json must be committed');
check(existsSync(join(root, 'data/imdb-ids.txt')), 'data/imdb-ids.txt must be committed');
const seedMb = statSync(join(root, 'data/imdb-seed.json')).size / 1024 / 1024;
check(seedMb > 3, `snapshot should be a real dataset, got ${seedMb.toFixed(1)} MB`);
const size = Seed.seedSize();
check(size.movies >= 10000, `expected >= 10,000 films, got ${size.movies}`);
check(size.series >= 500, `expected >= 500 series, got ${size.series}`);
check(size.generated.match(/^\d{4}-\d{2}-\d{2}$/), 'the snapshot carries its generation date');

const inception = Seed.seedMovie('tt1375666');
check(!!inception, 'tt1375666 must resolve from the snapshot');
eq(inception.slug, 'tt1375666', 'the IMDb id is the slug');
eq(inception.title, 'Inception');
eq(inception.year, 2010);
check(inception.rating > 8, 'rating comes from the dataset');
check(inception.poster.includes('metahub.space/poster/medium/tt1375666'), 'poster is built from the IMDb id');
check(inception.story.length > 40, 'a synopsis exists');
check(inception.cast.length >= 3, 'cast names exist');
check(inception.source === 'imdb-snapshot' && inception.snapshot === true, 'the card is marked as a snapshot');
check(Seed.seedMovie('tt0000000') === null, 'an unknown id returns null');
check(Seed.seedMovie('not-an-id') === null, 'a non IMDb id is rejected');

const series = Seed.seedMovie('tt0903747');
check(series && series.type === 'series', 'Breaking Bad is in the snapshot as a series');
check(series.seasons.length === 0, 'the snapshot has no episodes (Cinemeta supplies those when online)');

// search: title, cast, id, type filter
const byTitle = Seed.searchSeed('shawshank', { limit: 5 });
check(byTitle.length >= 1 && byTitle[0].title.toLowerCase().includes('shawshank'), 'title search works');
const byCast = Seed.searchSeed('morgan freeman', { limit: 8 });
check(byCast.length >= 2, `cast search should return several films, got ${byCast.length}`);
check(byCast.every((m) => m.slug.startsWith('tt')), 'cast results are IMDb ids');
const byId = Seed.searchSeed('tt1375666', { limit: 3 });
eq(byId.length, 1, 'an exact id returns exactly one title');
eq(byId[0].slug, 'tt1375666');
const onlySeries = Seed.searchSeed('breaking', { type: 'series', limit: 5 });
check(onlySeries.length >= 1 && onlySeries.every((m) => m.type === 'series'), 'type=series filters films out');
const onlyMovies = Seed.searchSeed('breaking', { type: 'movie', limit: 5 });
check(onlyMovies.every((m) => m.type === 'movie'), 'type=movie never returns a series');
eq(Seed.searchSeed('', { limit: 5 }).length, 0, 'an empty query searches nothing');

const rows = Seed.seedRows(12);
eq(rows.length, 3, 'three shelves: top rated, newest, series');
check(rows.every((r) => r.movies.length > 0 && r.movies.length <= 12), 'every shelf is filled and capped');
check(rows[0].movies[0].rating >= rows[0].movies[1].rating, 'the top-rated shelf is sorted');
const newest = Seed.seedNewest(30);
check(newest.length === 30 && newest[0].year >= newest[29].year, 'seedNewest is newest-first');
const upcoming = Seed.seedUpcoming(10, 2019);
check(upcoming.length > 0 && upcoming.every((m) => m.year >= 2019), 'seedUpcoming respects the reference year');
const ids = Seed.seedIds(50000);
check(ids.length >= 10000, `seedIds should expose a big pool, got ${ids.length}`);
check(ids.every((x) => /^tt\d{6,10}$/.test(x.id)), 'every id is a real IMDb id');
check(ids.some((x) => x.type === 'series'), 'series ids are included');
ok(`snapshot: ${size.movies.toLocaleString()} films + ${size.series} series · search by title/cast/id/type · rows, upcoming and ids verified`);

// ---------------------------------------------------------------- 2. wiring
const server = read('lib/moviesServer.js');
check(server.includes('seedFeatured'), 'the hub merges the snapshot');
check(server.includes('seedMovie'), 'the detail lookup falls back to the snapshot');
const searchApi = read('app/api/movies/search/route.js');
check(searchApi.includes('searchSeed'), 'the search API searches the snapshot');
check(searchApi.includes("'series'") && searchApi.includes("'movie'") && searchApi.includes('searchSeed'), 'the search API accepts a type filter');
check(searchApi.includes('snapshotCount'), 'the API reports how many snapshot hits it used');
const hubPage = read('app/movies/page.js');
check(hubPage.includes('seedRows') && hubPage.includes('seedSize'), 'the hub falls back to snapshot shelves');
const calendar = read('app/movies/calendar/page.js');
check(calendar.includes('seedNewest') && calendar.includes('seedUpcoming'), 'the calendar is fed by the snapshot');
const calLib = read('lib/movies.js');
check(calLib.includes('date TBA'), 'the calendar groups year-only titles under a real label');
const cal = M.buildReleaseCalendar([
  { title: 'Only A Year', year: 2025, releaseDate: '', status: 'released', region: 'International', type: 'movie' },
], { includeRecent: true, refDate: '2026-11-05' });
eq(cal.length, 1, 'a year-only title still lands on the calendar');
check(cal[0].label.includes('2025'), 'the group label names the year');
check(cal[0].label.includes('date TBA'), 'and says the date is TBA');
ok('wiring: hub shelves, detail lookup, search API (type filter) and the calendar year fallback verified');

// ---------------------------------------------------------------- 3. songs: singers + direct fallback
eq(Songs.artistSlug('Atif Aslam'), 'atif-aslam');
eq(Songs.artistSlug('A. R. Rahman'), 'a-r-rahman');
eq(Songs.artistNameFromSlug('atif-aslam'), 'Atif Aslam');
eq(Songs.artistNameFromSlug('arijit-singh'), 'Arijit Singh');
const songsServer = read('lib/songsServer.js');
for (const bit of ['getArtistSongs', 'getTrendingArtists', 'artistSlug']) check(songsServer.includes(bit), `songsServer must expose ${bit}`);
check(songsServer.includes('artists: artists.map'), 'the songs sitemap feed returns singers too');
const artistPage = read('app/songs/artist/[slug]/page.js');
check(artistPage.length > 2000, 'the singer page exists');
for (const bit of ['MusicGroup', 'getArtistSongs', 'SongBrowser', 'clockTime']) check(artistPage.includes(bit), `singer page must include ${bit}`);
check(read('app/songs/page.js').includes('getTrendingArtists'), 'the songs home shows a singers strip');
const client = read('lib/songsClient.js');
check(client.includes('CLIENT_MIRRORS') && client.includes('searchSongsDirect'), 'the browser fallback exists');
check(read('components/SongBrowser.js').includes('searchSongsDirect'), 'the browser uses the direct fallback');
check(read('components/SongDirectLoader.js').includes('songByIdDirect'), 'a song page retries in the browser');
check(read('app/songs/[slug]/page.js').includes('SongDirectLoader'), 'a failed song load never dead-ends');
check(read('app/songs/artist/[slug]/page.js').includes('songs/artist'), 'singers link to each other');
ok('songs: singer slugs, artist pages, singers strip, browser fallback and sitemap singers verified');

// ---------------------------------------------------------------- 4. sitemaps: every name, documented
const guide = read('app/sitemaps/page.js');
check(guide.length > 3000, '/sitemaps guide page exists');
check(!guide.includes('[null,'), 'no null breadcrumb paths');
for (const bit of ['/sitemap-index.xml', '/sitemap.xml', 'movies-0.xml', 'series-0.xml', 'actors.xml', 'live.xml', 'blog.xml', 'songs.xml', 'Search Console', 'MOVIES_SITEMAP_LIMIT']) {
  check(guide.includes(bit), `the sitemap guide must explain ${bit}`);
}
const doc = read('SITEMAPS.md');
check(doc.length > 3000, 'SITEMAPS.md must be a real guide');
for (const bit of ['/sitemap-index.xml', 'movies-0.xml', 'series-0.xml', 'actors.xml', 'live.xml', 'blog.xml', 'songs.xml', 'Search Console', '500,000', '20,000', 'imdb:ids']) {
  check(doc.includes(bit), `SITEMAPS.md missing ${bit}`);
}
const indexRoute = read('app/sitemap-index.xml/route.js');
check(indexRoute.includes('/sitemaps/songs.xml'), 'the index lists the songs sitemap');
const chunkRoute = read('app/sitemaps/[file]/route.js');
check(chunkRoute.includes('songs/artist/'), 'the songs sitemap includes singer pages');
const idsFile = read('data/imdb-ids.txt').trim().split('\n');
check(idsFile.length >= 50000, `the id file should be big, got ${idsFile.length}`);
check(idsFile.every((l) => l.startsWith('tt')), 'every line is an IMDb id');
check(read('next.config.js').includes("'./data/*.txt'"), 'the id file must ship with the deployment');
check(read('app/robots.js').includes('/sitemap-index.xml'), 'robots.txt advertises the index');
ok(`sitemaps: guide page, SITEMAPS.md, ${idsFile.length.toLocaleString()} ids and every file name verified`);

// ---------------------------------------------------------------- 4b. the player experience
const player = read('components/CinemaPlayer.js');
check(player.length > 40000, 'the player component is the full implementation');
for (const [needle, why] of [
  ["window.addEventListener('keydown'", 'shortcuts work without clicking the stage first'],
  ['theater', 'theater mode exists'],
  ['onTouchStart', 'touch gestures exist'],
  ['onTouchEnd', 'touch gestures exist'],
  ['webkitEnterFullscreen', 'iPhone fullscreen falls back to the video element'],
  ['Up next', 'the next episode auto-plays after a countdown'],
  ['Player shortcuts', 'a shortcut help panel exists'],
  ['Reload stream', 'embed streams can be reloaded'],
  ['THEATER', 'a visible theater button exists'],
  ['PictureInPicture2', 'picture-in-picture stays available'],
  ['playbackRate', 'speed control stays available'],
]) {
  check(player.includes(needle), `player must include ${needle} — ${why}`);
}
check(player.includes("if (k === 'f')"), 'F is fullscreen');
check(player.includes("if (k === 't')"), 'T is theater');
check(player.includes("hasNext && onNextEpisode"), 'the series next-episode path is wired');
const detailPage = read('app/movies/[slug]/page.js');
check(detailPage.includes('CinemaPlayer'), 'the movie page mounts the player');
check(detailPage.includes('companionProducts'), 'product ads still run before the stream');
ok('player: window shortcuts, theater, gestures, iOS fullscreen, next-episode autoplay and help panel verified');

// ---------------------------------------------------------------- 5. release hygiene
const pkg = JSON.parse(read('package.json'));
check(Number(String(pkg.version).split('.')[0]) >= 55, `version should be 55+, got ${pkg.version}`);
check(pkg.scripts.test.includes('test-v55.mjs'), 'v55 test is part of npm test');
check(pkg.scripts['imdb:seed'] === 'node scripts/build-imdb-seed.mjs', 'npm run imdb:seed exists');
check(read('scripts/build-imdb-seed.mjs').includes('Kaggle'), 'the snapshot builder documents its source');
check(read('UPGRADE-v55.md').length > 4000, 'UPGRADE-v55.md is a real guide');
const upgrade = read('UPGRADE-v55.md').toLowerCase();
for (const bit of ['snapshot', 'sitemap', 'singer', 'search', 'calendar', 'offline']) {
  check(upgrade.includes(bit), `UPGRADE-v55.md missing ${bit}`);
}
ok('release: version 55, docs, scripts and the test chain verified');

console.log(`\nAll ${checks} v55 checks passed.`);
