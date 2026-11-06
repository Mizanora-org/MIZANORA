/*
 * Mizanora v54 tests — "IMDb movies the MINEXUS way + Songs + a sitemap that covers everything".
 *
 * The complaint this release answers: "custom movie system hatao, MINEXUS ki tarah IMDb se chalao,
 * songs section lao, aur sitemap mein har tarah ki movie daalo". These tests pin down:
 *   1. Cinemeta (IMDb, zero API key) is the source of truth: meta, catalog, cast, episodes, posters
 *   2. the IMDb id is the slug, so /movies/tt1375666 always works — no hand-curated catalogue needed
 *   3. the sitemap index + 20,000-URL chunks + the IMDb dataset script (latest 500,000 titles)
 *   4. the Songs section: normalisation, slug ids, the mirror race, the pages, the sitemap file
 *   5. navigation, admin console, version and docs all agree
 *
 * Run: node --experimental-loader ./scripts/test-v30-loader.mjs scripts/test-v54.mjs
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

const C = await import(pathToFileURL(join(root, 'lib/cinemeta.js')).href);
const W = await import(pathToFileURL(join(root, 'lib/moviesWorld.js')).href);
const S = await import(pathToFileURL(join(root, 'lib/songs.js')).href);

// ---------------------------------------------------------------- 1. Cinemeta, the MINEXUS way
check(C.CINEMETA_BASE === 'https://v3-cinemeta.strem.io', 'Cinemeta base is the same one MINEXUS uses');
check(C.METAHUB_BASE === 'https://images.metahub.space', 'posters come from the keyless Metahub CDN');
eq(C.cinemetaYear('2010–2015'), 2010);
eq(C.cinemetaYear('2026'), 2026);
eq(C.cinemetaYear(''), 0, 'an empty releaseInfo is 0, never NaN');
eq(C.cinemetaRuntime('148 min'), 148);
eq(C.cinemetaRuntime('2h 16min'), 136);
eq(C.cinemetaRuntime(''), 0);

const meta = {
  id: 'tt1375666',
  type: 'movie',
  name: 'Inception',
  releaseInfo: '2010',
  runtime: '148 min',
  imdbRating: '8.8',
  genres: ['Action', 'Sci-Fi', 'Thriller'],
  cast: ['Leonardo DiCaprio', 'Joseph Gordon-Levitt', { name: 'Elliot Page' }],
  director: ['Christopher Nolan'],
  description: 'A thief who steals corporate secrets through dream-sharing.',
  trailers: [{ source: 'YouTube', youtubeId: 'YoHD9XEInc0' }, { source: 'Other', youtubeId: 'x' }],
  country: 'United States',
  released: '2010-07-16',
};
check(C.cinemetaPoster(meta).endsWith('/poster/medium/tt1375666/img'), 'Metahub poster by IMDb id');
check(C.cinemetaBackdrop(meta).endsWith('/background/medium/tt1375666/img'), 'Metahub backdrop by IMDb id');
eq(C.cinemetaTrailer(meta), 'YoHD9XEInc0', 'only a real YouTube id is used as a trailer');
eq(C.cinemetaCast(meta).map((c) => c.name), ['Leonardo DiCaprio', 'Joseph Gordon-Levitt', 'Elliot Page']);

const film = C.movieFromCinemeta(meta, 'movie');
check(!!film, 'a Cinemeta meta becomes a movie card');
eq(film.slug, 'tt1375666', 'THE SLUG IS THE IMDb ID — no custom catalogue entry needed');
eq(film.imdbId, 'tt1375666');
eq(film.type, 'movie');
eq(film.year, 2010);
eq(film.rating, 8.8);
eq(film.runtime, 148);
eq(film.cast.length, 3);
check(film.source === 'cinemeta' && film.cinemeta === true, 'the card is marked as IMDb-sourced');
check(film.poster.includes('metahub.space'), 'poster never empty for a title that has one');
check(/imdb\.com\/title\/tt1375666/.test(JSON.stringify(film.legalProviders)), 'the IMDb page is the official info link');
check(!C.movieFromCinemeta({ id: 'nope', name: 'X' }, 'movie'), 'a non IMDb id is rejected');
check(!C.movieFromCinemeta({ id: 'tt1234567' }, 'movie'), 'a title without a name is rejected');

const seriesMeta = {
  id: 'tt0903747',
  type: 'series',
  name: 'Breaking Bad',
  releaseInfo: '2008–2013',
  videos: [
    { season: 1, number: 1, name: 'Pilot', released: '2008-01-20', overview: 'A chemistry teacher gets a diagnosis.' },
    { season: 1, number: 2, name: "Cat's in the Bag...", released: '2008-01-27' },
    { season: 2, number: 1, name: 'Seven Thirty-Seven', released: '2009-03-08' },
  ],
};
const seasons = C.episodesFromCinemeta(seriesMeta);
eq(seasons.length, 2, 'episodes are grouped by season');
eq(seasons[0].season, 1);
eq(seasons[0].episodes.length, 2);
eq(seasons[0].episodes[0].e, 1);
eq(seasons[0].episodes[0].airDate, '2008-01-20');
eq(seasons[1].season, 2);
const drama = C.movieFromCinemeta(seriesMeta, 'series');
eq(drama.type, 'series');
eq(drama.seasons.length, 2, 'a series card carries its whole episode list');

const future = C.movieFromCinemeta({ id: 'tt9999999', name: 'Coming Soon', type: 'movie', releaseInfo: '2031' }, 'movie');
eq(future.status, 'upcoming', 'a future year is automatically "upcoming"');
check(future.legalProviders.length > 0);

// network shape (injected fetcher, no real calls)
const seenUrls = [];
const fakeFetch = (url) => {
  seenUrls.push(url);
  if (url.includes('/meta/')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ meta }) });
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ metas: [meta, { ...meta, id: 'tt0133093', name: 'The Matrix' }] }) });
};
C.clearCinemetaCache();
const got = await C.cinemetaMeta('tt1375666', { fetcher: fakeFetch });
check(got && got.meta && got.meta.id === 'tt1375666', 'cinemetaMeta resolves an IMDb id (movie first, series second)');
const card = await C.cinemetaMovie('tt1375666', { fetcher: fakeFetch });
check(card && card.slug === 'tt1375666', 'cinemetaMovie returns a ready card');
eq(seenUrls[0], 'https://v3-cinemeta.strem.io/meta/movie/tt1375666.json', 'meta URL is exactly the MINEXUS one');
const list = await C.cinemetaCatalog({ type: 'series', catalog: 'top', genre: 'Drama', skip: 100, fetcher: fakeFetch });
eq(list.length, 2, 'a catalog page returns every meta');
check(seenUrls.at(-1).includes('/catalog/series/top/genre=Drama&skip=100.json'), `catalog URL shape: ${seenUrls.at(-1)}`);
const found = await C.cinemetaSearch('inception', { fetcher: fakeFetch });
check(found.length >= 1, 'search hits the IMDb catalogue');
ok('cinemeta: meta/catalog/search, cast, trailer, episodes and the IMDb-id slug all verified');

// ---------------------------------------------------------------- 2. the IMDb id pool + sitemap maths
check(W.WORLD_GENRES.length >= 8, 'the world catalogue covers at least eight genres');
eq(W.chunkCount(0), 1, 'even an empty pool gets one file');
eq(W.chunkCount(20000), 1);
eq(W.chunkCount(20001), 2);
eq(W.chunkCount(500000), 25, 'the latest 500,000 titles become 25 valid sitemap files');
check(W.SITEMAP_CHUNK === 20000 && W.SITEMAP_CHUNK < 50000, 'chunk size stays under the 50,000 legal limit');

const parsed = W.parseIdList('tt0111161\ntt0903747\tseries\t2008\nnonsense\nTT0133093\n', 10);
eq(parsed.map((x) => x.id), ['tt0111161', 'tt0903747', 'tt0133093'], 'ids are validated, lowercased and deduped');
eq(parsed[1].type, 'series', 'the type column is honoured (series sitemap)');
eq(parsed[1].year, 2008, 'the year column is honoured (newest-first ordering)');

const oldEnv = process.env.MOVIES_SITEMAP_LIMIT;
process.env.MOVIES_SITEMAP_LIMIT = '12345';
eq(W.sitemapMovieLimit(), 12345, 'the env var sets the sitemap size');
process.env.MOVIES_SITEMAP_LIMIT = '9999999';
eq(W.sitemapMovieLimit(), 500000, 'the sitemap never promises more than 500,000 (the demand, capped)');
delete process.env.MOVIES_SITEMAP_LIMIT;
const noDataset = W.sitemapMovieLimit();
check([20000, 500000].includes(noDataset), 'without an env the limit follows the dataset presence');
if (oldEnv !== undefined) process.env.MOVIES_SITEMAP_LIMIT = oldEnv;

const indexRoute = read('app/sitemap-index.xml/route.js');
// v56: the catalogue is now published one file per release year (titles-YYYY) instead of 20k-row
// chunks, so accept either shape — what must stay true is that every family is listed.
for (const bit of ['/sitemaps/actors.xml', '/sitemaps/live.xml', '/sitemaps/blog.xml', '/sitemaps/songs.xml', '/sitemap.xml']) {
  check(indexRoute.includes(bit), `sitemap index must list ${bit}`);
}
check(indexRoute.includes('sitemaps/movies-') || indexRoute.includes('titles-'), 'the index lists the movie/series catalogue');
check(indexRoute.includes('chunkCount') || indexRoute.includes('years'), 'the index derives its file list from the real pool');
const chunkRoute = read('app/sitemaps/[file]/route.js');
for (const bit of ['getSitemapIds', 'SITEMAP_CHUNK', 'getSongsForSitemap', 'getTvConfig', 'getMoviesHub', 'getPosts']) {
  check(chunkRoute.includes(bit), `the chunk route must use ${bit}`);
}
const robots = read('app/robots.js');
check(robots.includes('/sitemap-index.xml') && robots.includes('/sitemap.xml'), 'robots.txt advertises both sitemaps');
const coreSitemap = read('app/sitemap.js');
check(coreSitemap.includes("'/songs'") && coreSitemap.includes("'/movies/world'"), 'core sitemap includes songs and the world catalogue');

const builder = read('scripts/build-imdb-ids.mjs');
check(builder.includes('datasets.imdbws.com/title.basics.tsv.gz'), 'the id builder reads IMDb\'s own dataset');
for (const bit of ['createGunzip', 'LIMIT', 'movie', 'series', 'imdb-ids.txt']) check(builder.includes(bit), `builder handles ${bit}`);
const workflow = read('.github/workflows/imdb-ids.yml');
check(workflow.includes('build-imdb-ids.mjs') && workflow.includes('schedule'), 'a weekly Action refreshes the id list');
ok('sitemap: index + chunks + 500k dataset builder + weekly refresh verified');

// ---------------------------------------------------------------- 3. Songs
eq(S.songSlug('Tum Hi Ho (From "Aashiqui 2")'), 'tum-hi-ho-from-aashiqui-2');
eq(S.clockTime(213), '3:33');
eq(S.clockTime(3725), '1:02:05');

const raw = {
  id: 'abc123XYZ',
  name: 'Tum Hi Ho',
  duration: 261,
  year: 2013,
  language: 'hindi',
  url: 'http://a.audiocdn.example/stream.mp3',
  image: [{ quality: '50x50', url: 'https://img.example/small.jpg' }, { quality: '500x500', url: 'https://img.example/big.jpg' }],
  downloadUrl: [{ quality: '96kbps', link: 'https://a.example/96.mp3' }, { quality: '320kbps', link: 'https://a.example/320.mp3' }],
  artists: { primary: [{ name: 'Arijit Singh' }], featured: [{ name: 'Pritam' }] },
  album: { name: 'Aashiqui 2' },
};
const song = S.cleanSong(raw);
check(!!song, 'a raw JioSaavn song normalises');
eq(song.title, 'Tum Hi Ho');
eq(song.artists, ['Arijit Singh', 'Pritam']);
eq(song.album, 'Aashiqui 2');
eq(song.image, 'https://img.example/big.jpg', 'the biggest artwork wins');
eq(song.stream, 'https://a.example/320.mp3', 'the best-quality downloadUrl link is the stream');
eq(S.songStream({ media_url: 'http://cdn.example/live.mp3' }), 'https://cdn.example/live.mp3', 'http audio is upgraded to https (https pages cannot play http)');
check(song.hasStream);
eq(song.slug, 'tum-hi-ho-abc123XYZ');
eq(S.songIdFromSlug(song.slug), 'abc123XYZ', 'a song page address carries the real id');
check(!S.cleanSong({ id: 'x' }), 'a song without a title is dropped');
check(!S.songStream({ downloadUrl: [{ quality: '320kbps', link: 'https://a.example/x.mp3' }] }).includes('http://'), 'fallback stream is https too');
const dedup = S.songsFromPayload({ data: { results: [raw, { ...raw }, { id: 'zzz999', name: 'Other', url: 'https://a.example/o.mp3' }] } });
eq(dedup.length, 2, 'payload shapes are unwrapped and duplicates removed');
eq(S.songsFromPayload({ data: { songs: [raw] } }).length, 1, 'data.songs shape works');
eq(S.songsFromPayload({ results: [raw] }).length, 1, 'bare results shape works');
check(S.SONG_QUERIES.length >= 8, 'the trending seed has a real mix of artists');

const songsServer = read('lib/songsServer.js');
for (const bit of ['Promise.any', 'saavn.dev', 'jiosavan-api2.vercel.app', 'searchSongs', 'getSongById', 'getTrendingSongs', 'getSongsForSitemap', 'SONGS_API_BASE']) {
  check(songsServer.includes(bit), `songs server must handle ${bit}`);
}
check(!/fetch\([^)]*\)[\s\S]{0,40}client/.test(songsServer), 'the mirrors are never called from the browser');
console.log(`      · ${S.SONG_QUERIES.length} trending seeds · ${S.clockTime(261)} sample · ${dedup.length} deduped`);
ok('songs: normalisation, https upgrade, slug ids, mirror race and sitemap feed verified');

// ---------------------------------------------------------------- 4. the pages exist and are wired
for (const p of ['app/songs/page.js', 'app/songs/[slug]/page.js', 'app/api/songs/search/route.js', 'app/api/songs/[id]/route.js', 'app/admin/songs/page.js', 'components/SongBrowser.js', 'components/SongDetailPlayer.js', 'app/movies/world/page.js']) {
  check(read(p).length > 200, `${p} must exist`);
}
const songPage = read('app/songs/[slug]/page.js');
for (const bit of ['MusicRecording', 'SongDetailPlayer', 'clockTime', 'generateMetadata', 'related']) {
  check(songPage.includes(bit), `the song page must include ${bit}`);
}
const browser = read('components/SongBrowser.js');
for (const bit of ['/api/songs/search', 'useMusic', 'clockTime', 'music.play']) check(browser.includes(bit), `the browser must include ${bit}`);
check(!browser.includes('fetch(`https://saavn'), 'the browser never calls a music mirror directly');

const detail = read('app/movies/[slug]/page.js');
check(detail.includes('Seasons &amp; Episodes'), 'a series page shows the episode guide');
check(detail.includes('cinemetaCatalog'), 'similar titles fall back to the IMDb genre');
const server = read('lib/moviesServer.js');
check(server.includes('cinemetaMovie'), 'the movie server resolves Cinemeta first');
check(server.includes('lookupOfficialByImdbId'), 'IMDb id lookup is still the entry point');
const searchRoute = read('app/api/movies/search/route.js');
check(searchRoute.includes('cinemetaSearch'), 'movie search hits the IMDb catalogue');
check(searchRoute.includes('IMDb catalogue'), 'the UI can say where a result came from');
const hub = read('app/movies/page.js');
check(hub.includes('getWorldRows'), 'the hub shows IMDb world rows');
const world = read('app/movies/world/page.js');
check(world.includes('cinemetaCatalog') && world.includes('WORLD_GENRES'), 'the world page browses the IMDb catalogue');

const header = read('components/Header.js');
check(header.includes('href="/songs"'), 'Songs is in the header');
check(read('components/Footer.js').includes("'/songs'"), 'Songs is in the footer');
check(read('components/AdminNav.js').includes('/admin/songs'), 'Songs console is in the admin menu');
ok('pages: songs browser, song page, admin console, episode guide and IMDb search all wired');


// ---------------------------------------------------------------- 4b. the custom catalogue is gone
const CAT = await import(pathToFileURL(join(root, 'lib/moviesCatalog.js')).href);
eq(CAT.STARTER_MOVIES.length, 0, 'the 180 hand-written starter movies are removed');
eq(CAT.STARTER_ACTORS.length, 0, 'the starter actor list is removed');
check(CAT.MOVIE_GENRES.length >= 6 && CAT.MOVIE_REGIONS.length >= 5, 'genres and regions stay (admin filters need them)');
check(server.includes('customMovies: []'), 'the hub drops hand-added movie documents');
check(server.includes('getWorldRows'), 'the hub is built from the IMDb world catalogue');
check(server.includes('clearMoviesHubCache'), 'the hub cache can be refreshed from the console');
const adminMovies = read('app/admin/movies/page.js');
check(adminMovies.includes('MovieServersAdmin'), 'the console still mounts the play-server manager');
check(!/customMovies|Add movie|EMPTY_FORM/.test(adminMovies), 'the admin page no longer offers a custom-movie form');
check(adminMovies.includes('/api/movies/search'), 'the console tests the real IMDb search');
ok('custom movies: starter list emptied, hub rebuilt from Cinemeta, admin CRUD replaced by a console');

// ---------------------------------------------------------------- 5. release hygiene
const pkg = JSON.parse(read('package.json'));
check(Number(String(pkg.version).split('.')[0]) >= 54, `version should be 54 or newer, got ${pkg.version}`);
check(pkg.scripts['imdb:ids'] === 'node scripts/build-imdb-ids.mjs', 'npm run imdb:ids exists');
check(pkg.scripts.test.includes('test-v54.mjs'), 'v54 test is part of npm test');
const doc = read('UPGRADE-v54.md');
check(doc.length > 4000, 'UPGRADE-v54.md is a long, real guide');
for (const bit of ['cinemeta', 'songs', 'sitemap', '500,000', 'MOVIES_SITEMAP_LIMIT', 'imdb:ids']) {
  check(doc.toLowerCase().includes(bit.toLowerCase()), `UPGRADE-v54.md missing ${bit}`);
}
const blog = read('content/blog/mizanora-v54-imdb-catalogue-songs-sitemap.md');
check(blog.length > 2000, 'the v54 guide blog post exists');
check(blog.toLowerCase().includes('sitemap'), 'the blog post explains the sitemap');

console.log(`\nAll ${checks} v54 checks passed.`);
