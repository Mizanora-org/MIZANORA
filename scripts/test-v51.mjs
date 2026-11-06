// Mizanora v51 tests — world catalogue search, admin Play Servers, template link builder,
// Cinema Player (ad + quality + audio + captions + resume), legal pages and wiring.
// Run: node scripts/test-v51.mjs (wired into `npm test`)
//
// No network: every catalogue call is replaced by a mock fetch, so this file proves the parsers
// work even when TMDB/IMDb/TVmaze are unreachable from the machine running the tests.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const imp = (p) => import(pathToFileURL(path.join(root, p)).href);

let pass = 0;
const ok = (msg) => { pass += 1; console.log(`ok    ${msg}`); };

const SV = await imp('lib/movieServers.js');
const M = await imp('lib/movies.js');
const Auto = await imp('lib/moviesAutoFeed.js');
const Prog = await imp('lib/movieProgress.js');
const List = await imp('lib/movieList.js');

// ---------------------------------------------------------------------------------------------
// 1. Template validation
// ---------------------------------------------------------------------------------------------
for (const good of [
  'https://cdn.example.com/play/{imdbid}',
  'https://cdn.example.com/play/{IMDBID}',
  'https://cdn.example.com/embed/movie/{imdb}?s={season}&e={episode}',
  'https://cdn.example.com/movies/{slug}.mp4',
  'https://cdn.example.com/{year}/{title}/master.m3u8',
]) {
  assert.equal(SV.validateServerTemplate(good).ok, true, `must accept ${good}`);
}

const badTemplates = [
  ['', 'empty'],
  ['http://cdn.example.com/play/{imdbid}', 'http is refused'],
  ['https://localhost/play/{imdbid}', 'localhost is refused'],
  ['https://127.0.0.1/play/{imdbid}', 'raw IPv4 is refused'],
  ['https://cdn.example.com/{nope}', 'unknown token is refused'],
  ['https://cdn.example.com/play/', 'still valid technically'],
  ['not a url', 'no URL'],
  ['https://user:pass@cdn.example.com/a.mp4', 'credentials refused'],
  ['javascript:alert(1)', 'javascript refused'],
];
for (const [tpl, why] of badTemplates) {
  if (why === 'still valid technically') {
    // A URL with no token is allowed on purpose: some providers serve one page for the whole site.
    assert.equal(SV.validateServerTemplate(tpl).ok, true);
    continue;
  }
  assert.equal(SV.validateServerTemplate(tpl).ok, false, `${why}: ${tpl}`);
}
assert.equal(SV.validateServerTemplate(`https://cdn.example.com/${'a'.repeat(400)}`).ok, false, 'too long is refused');
ok('templates: https + public hosts only, unknown tokens and credentials refused');

// ---------------------------------------------------------------------------------------------
// 2. cleanServer / cleanServersList
// ---------------------------------------------------------------------------------------------
const s1 = SV.cleanServer({ id: 'hd-1', name: 'HD Server', template: 'https://cdn.example.com/play/{imdbid}', rightsConfirmed: true }, 0);
assert.ok(s1);
assert.equal(s1.id, 'hd-1');
assert.equal(s1.host, 'cdn.example.com');
assert.equal(s1.kind, 'embed', 'no extension means embed');
assert.equal(s1.quality, 'Auto');
assert.equal(s1.enabled, true);
assert.equal(s1.scope, 'all');
assert.equal(s1.episodic, false);

const s2 = SV.cleanServer({ name: 'Series HD', template: 'https://cdn.example.com/s/{imdbid}/{season}/{episode}.m3u8', scope: 'series', quality: '1080p', rightsConfirmed: true }, 1);
assert.equal(s2.kind, 'hls', '.m3u8 is detected as HLS');
assert.equal(s2.episodic, true, 'template with {season}/{episode} is episodic');
assert.equal(s2.scope, 'series');

const s3 = SV.cleanServer({ name: 'MP4', template: 'https://cdn.example.com/movies/{imdbid}.mp4', rightsConfirmed: true });
assert.equal(s3.kind, 'mp4');

assert.equal(SV.cleanServer({ name: 'Bad', template: 'http://x.com/a.mp4' }), null, 'http template cannot be cleaned into a server');
assert.equal(SV.cleanServer({ name: '', template: 'https://x.com/a.mp4' }), null, 'name is required');

const dupes = SV.cleanServersList([
  { name: 'Same', template: 'https://a.example.com/play/{imdbid}', rightsConfirmed: true },
  { name: 'Same', template: 'https://b.example.com/play/{imdbid}', rightsConfirmed: true },
]);
assert.equal(dupes.length, 2);
assert.notEqual(dupes[0].id, dupes[1].id, 'duplicate ids are made unique');
ok('servers: kinds detected, episodic/scoped templates kept, ids de-duplicated');

// ---------------------------------------------------------------------------------------------
// 3. Link builder — movies AND series
// ---------------------------------------------------------------------------------------------
const movieInfo = { imdbId: 'tt12425792', slug: 'the-legend-of-maula-jatt-2022', title: 'The Legend of Maula Jatt', year: 2022, type: 'movie', season: 1, episode: 1 };
assert.equal(SV.buildServerUrl('https://cdn.example.com/play/{imdbid}', movieInfo), 'https://cdn.example.com/play/tt12425792');
assert.equal(SV.buildServerUrl('https://cdn.example.com/{tt}/{year}', movieInfo), 'https://cdn.example.com/tt12425792/2022');
assert.equal(
  SV.buildServerUrl('https://cdn.example.com/{slug}/{title}', movieInfo),
  'https://cdn.example.com/the-legend-of-maula-jatt-2022/The%20Legend%20of%20Maula%20Jatt',
  '{title} is URL-encoded, {slug} is URL-safe',
);
const seriesInfo = { ...movieInfo, type: 'series', season: 3, episode: 7 };
assert.equal(
  SV.buildServerUrl('https://cdn.example.com/s/{imdbid}/{season}/{episode}', seriesInfo),
  'https://cdn.example.com/s/tt12425792/3/7',
);
assert.equal(SV.buildServerUrl('https://cdn.example.com/s/{s}/{e}', seriesInfo), 'https://cdn.example.com/s/3/7');
assert.equal(SV.buildServerUrl('https://cdn.example.com/x/{imdbid}', { imdbId: 'nope' }), 'https://cdn.example.com/x/', 'invalid IMDb id becomes empty, never invented');
ok('links: {imdbid} {tt} {slug} {title} {year} {season} {episode} build exactly the right URL');

// ---------------------------------------------------------------------------------------------
// 4. resolveMovieServers — only servers that can actually play THIS title
// ---------------------------------------------------------------------------------------------
const servers = [
  SV.cleanServer({ name: 'Movies + Series', template: 'https://cdn.example.com/play/{imdbid}', scope: 'all', priority: 2, rightsConfirmed: true }),
  SV.cleanServer({ name: 'Series only', template: 'https://cdn.example.com/s/{imdbid}/{season}/{episode}.m3u8', scope: 'series', priority: 1, rightsConfirmed: true }),
  SV.cleanServer({ name: 'No IMDb needed', template: 'https://cdn.example.com/media/{slug}.mp4', scope: 'movie', priority: 3, rightsConfirmed: true }),
  { ...SV.cleanServer({ name: 'Switched off', template: 'https://cdn.example.com/off/{imdbid}', rightsConfirmed: true }), enabled: false },
];
const forMovie = SV.resolveMovieServers(servers, movieInfo);
assert.equal(forMovie.length, 2, 'movie gets both "all" and "movie" servers, not the series or OFF one');
assert.deepEqual(forMovie.map((s) => s.name), ['Movies + Series', 'No IMDb needed'], 'priority order is respected');

const forSeries = SV.resolveMovieServers(servers, { ...movieInfo, type: 'series' });
assert.equal(forSeries.length, 2);
assert.deepEqual(forSeries.map((s) => s.name), ['Series only', 'Movies + Series']);
assert.ok(forSeries[0].url.includes('/s/tt12425792/1/1'), 'series URL is built with season/episode');

// A template that needs an IMDb id must be skipped for a title without one (the empty /play/ bug).
const noImdb = SV.resolveMovieServers(servers, { imdbId: '', slug: 'some-title', type: 'movie' });
assert.equal(noImdb.length, 1);
assert.equal(noImdb[0].name, 'No IMDb needed');

// Duplicate URLs are shown once.
const twice = SV.resolveMovieServers(
  [
    SV.cleanServer({ name: 'A', template: 'https://same.example.com/play/{imdbid}', rightsConfirmed: true }),
    SV.cleanServer({ name: 'B', template: 'https://same.example.com/play/{imdbid}', rightsConfirmed: true }),
  ],
  movieInfo,
);
assert.equal(twice.length, 1, 'the same resolved URL appears only once');

const stats = SV.describeServers(servers);
assert.equal(stats.total, 4);
assert.equal(stats.on, 3);
assert.ok(stats.kinds.includes('hls') && stats.kinds.includes('mp4') && stats.kinds.includes('embed'));
ok('resolve: scope, ON/OFF, missing-IMDb skip, duplicate URL removal and priority order verified');

// ---------------------------------------------------------------------------------------------
// 5. Ads config clamps
// ---------------------------------------------------------------------------------------------
const cfg = SV.cleanMoviesServersConfig({ servers, ads: { seconds: 999, skipAfter: -5, headline: '  Mizanora   Store ', note: '' } });
assert.equal(cfg.ads.seconds, 30);
assert.equal(cfg.ads.skipAfter, 0);
assert.equal(cfg.ads.headline, 'Mizanora Store');
assert.ok(cfg.ads.note.length > 0, 'empty ad note falls back to the default line');
assert.equal(cfg.servers[0].priority <= cfg.servers[cfg.servers.length - 1].priority, true, 'servers are sorted by priority');
assert.equal(SV.cleanMoviesServersConfig({}).enabled, true, 'player is ON by default');
ok('ads: seconds/skipAfter clamped, defaults kept, servers sorted');

// ---------------------------------------------------------------------------------------------
// 6. World catalogue search with a mock fetch (no network at all)
// ---------------------------------------------------------------------------------------------
const imdbPayload = {
  d: [
    { id: 'tt15354916', l: 'Jawan', y: 2023, qid: 'movie', q: 'feature', rank: 400, s: 'Shah Rukh Khan, Nayanthara', i: { imageUrl: 'http://m.media-amazon.com/images/M/jawan.jpg' } },
    { id: 'nm0000123', l: 'Shah Rukh Khan', s: 'Actor, Producer', i: { imageUrl: 'https://m.media-amazon.com/images/M/srk.jpg' } },
    { id: 'tt99999999', l: '', y: 0 },
  ],
};
const tvmazeSearch = [
  {
    score: 9,
    show: {
      id: 55,
      name: 'Parizaad',
      language: 'Urdu',
      premiered: '2021-07-20',
      status: 'Ended',
      externals: { imdb: 'tt14522964' },
      network: { country: { code: 'PK', name: 'Pakistan' }, name: 'Hum TV' },
      summary: '<p>A young man&rsquo;s quiet rise.</p>',
      image: { original: 'http://static.tvmaze.com/parizaad.jpg' },
      _embedded: { cast: [{ person: { name: 'Ahmed Ali Akbar', image: { medium: 'https://static.tvmaze.com/ahmed.jpg' } }, character: { name: 'Parizaad' } }] },
    },
  },
];

const mockFetch = async (url) => {
  const u = String(url);
  let body = null;
  if (u.includes('sg.media-imdb.com')) body = imdbPayload;
  else if (u.includes('api.tvmaze.com/search/shows')) body = tvmazeSearch;
  else if (u.includes('api.tvmaze.com/lookup/shows')) body = tvmazeSearch[0].show;
  else if (u.includes('api.themoviedb.org')) body = { results: [] };
  return { ok: Boolean(body), json: async () => body || {} };
};

const parsed = Auto.movieFromImdbSuggestion(imdbPayload.d[0]);
assert.ok(parsed);
assert.equal(parsed.imdbId, 'tt15354916');
assert.equal(parsed.title, 'Jawan');
assert.equal(parsed.year, 2023);
assert.equal(parsed.type, 'movie');
assert.equal(parsed.poster, 'https://m.media-amazon.com/images/M/jawan.jpg', 'poster is upgraded to https');
assert.ok(parsed.cast.some((c) => c.name === 'Shah Rukh Khan'));
assert.equal(Auto.movieFromImdbSuggestion(imdbPayload.d[1]), null, 'persons (nm...) are not movies');
assert.equal(Auto.movieFromImdbSuggestion(imdbPayload.d[2]), null, 'rows without a title are dropped');

const imdbHits = await Auto.searchImdbSuggestions('jawan', { fetchFn: mockFetch });
assert.equal(imdbHits.length, 1);
assert.equal(imdbHits[0].imdbId, 'tt15354916');

const tvmazeHits = await Auto.searchTvmazeShows('parizaad', { fetchFn: mockFetch });
assert.equal(tvmazeHits.length, 1);
assert.equal(tvmazeHits[0].imdbId, 'tt14522964');
assert.equal(tvmazeHits[0].type, 'series');
assert.ok(tvmazeHits[0].cast.some((c) => c.photo === 'https://static.tvmaze.com/ahmed.jpg'), 'cast portrait is carried through');

const world = await Auto.searchWorldCatalog('jawan', { fetchFn: mockFetch, tmdbApiKey: '' });
assert.ok(world.items.length >= 2, `world search merges IMDb + TVmaze, got ${world.items.length}`);
assert.equal(new Set(world.items.map((m) => m.imdbId)).size, world.items.length, 'no duplicate IMDb ids');
assert.ok(world.items[0].title.toLowerCase().includes('jawan'), 'exact title ranks first');
assert.ok(world.sources.some((s) => s.source === 'IMDb'));

const empty = await Auto.searchWorldCatalog('x', { fetchFn: mockFetch });
assert.equal(empty.items.length, 0, 'one letter does not hit the network');

const offline = await Auto.searchWorldCatalog('anything', { fetchFn: async () => ({ ok: false, json: async () => ({}) }) });
assert.equal(offline.items.length, 0, 'a dead network returns an empty list, not a crash');

const person = await Auto.lookupPersonImage('Shah Rukh Khan', { fetchFn: mockFetch });
assert.equal(person.photo, 'https://m.media-amazon.com/images/M/srk.jpg');
assert.equal(person.imdbId, 'nm0000123');
ok('world search: IMDb + TVmaze parsed, https posters, persons ignored, dedupe & ranking, offline safe');

// ---------------------------------------------------------------------------------------------
// 7. Placeholder page for an IMDb id whose metadata could not be fetched
// ---------------------------------------------------------------------------------------------
const stub = M.stubMovieFromImdbId('tt22084616');
assert.ok(stub);
assert.equal(stub.imdbId, 'tt22084616');
assert.equal(stub.stub, true);
assert.equal(stub.slug, 'tt22084616');
assert.ok(stub.story.length > 20);
assert.equal(M.stubMovieFromImdbId('not-an-id'), null);
ok('fallback: a valid tt id renders a placeholder page (noindex) instead of a 404');

// ---------------------------------------------------------------------------------------------
// 7b. Continue watching helpers (pure, safe without a browser)
// ---------------------------------------------------------------------------------------------
assert.equal(Prog.clockLabel(65), '1:05');
assert.equal(Prog.clockLabel(3725), '1:02:05');
assert.equal(Prog.clockLabel(-3), '0:00');
assert.equal(Prog.progressPercent({ t: 30, d: 120 }), 25);
assert.equal(Prog.progressPercent({ t: 0, d: 120 }), 0);
assert.equal(Prog.progressPercent({ t: 5, d: 0 }), 0);
assert.deepEqual(Prog.readRecent(), [], 'no window means an empty list, never a crash');
assert.deepEqual(Prog.touchRecent({ id: 'tt1', title: 'x' }), [], 'touchRecent must be safe without a browser');
ok('continue watching: clock labels, progress %, and browser-less safety verified');

assert.deepEqual(List.readList(), [], 'an empty list without a browser, never a crash');
assert.equal(List.inList('tt1234567'), false);
assert.deepEqual(List.addToList({ id: 'tt1234567', title: 'Test Movie' }), []);
assert.equal(List.toggleListItem({ id: 'tt1234567', title: 'Test Movie' }).added, true);
assert.deepEqual(List.removeListItem('tt1234567'), []);
assert.deepEqual(List.clearList(), []);
assert.equal(List.MAX_LIST > 0, true);
ok('my list: add / toggle / remove / clear are all browser-safe and pure');

// ---------------------------------------------------------------------------------------------
// 8. Files & wiring
// ---------------------------------------------------------------------------------------------
for (const f of [
  'lib/movieServers.js',
  'lib/movieServersServer.js',
  'components/MovieServersAdmin.js',
  'app/api/admin/movie-servers/route.js',
  'app/api/movies/servers/route.js',
  'app/api/movies/search/route.js',
  'app/licence/page.js',
  'app/copyright/page.js',
  'UPGRADE-v51.md',
]) {
  assert.ok(exists(f), `missing ${f}`);
}

const adminRoute = read('app/api/admin/movie-servers/route.js');
for (const action of ["'load'", "'add'", "'update'", "'delete'", "'toggle'", "'move'", "'duplicate'", "'bulkAdd'", 'verifyAdmin']) {
  assert.ok(adminRoute.includes(action), `admin API must handle ${action}`);
}
assert.ok(adminRoute.includes('rightsConfirmed'), 'admin API asks the admin to confirm streaming rights');

const adminUI = read('components/MovieServersAdmin.js');
for (const bit of ['Add server', 'Save changes', 'Delete', 'rightsConfirmed', 'buildServerUrl', '/api/admin/movie-servers']) {
  assert.ok(adminUI.includes(bit), `admin UI missing ${bit}`);
}
assert.ok(read('app/admin/movies/page.js').includes('MovieServersAdmin'), '/admin/movies must mount the play-server manager');

const player = read('components/CinemaPlayer.js');
for (const bit of ['AdRoll', 'Skip ad', 'resolveMovieServers', 'AUDIO_TRACKS_UPDATED', 'SUBTITLE_TRACKS_UPDATED', 'pictureInPicture', 'Resume from', 'hls.js', 'abrEwmaDefaultEstimate', 'requestFullscreen', 'toDataURL']) {
  assert.ok(player.includes(bit), `player missing ${bit}`);
}
for (const bit of ['patchRecentProgress', 'handleServerError', 'pickServer', 'next server']) {
  assert.ok(player.toLowerCase().includes(bit.toLowerCase()), `player missing ${bit}`);
}
assert.ok(read('app/movies/page.js').includes('ContinueWatching'), 'the hub must show the continue-watching shelf');
assert.ok(adminUI.includes('Bulk add') && adminUI.includes("action: 'bulkAdd'"), 'admin UI needs the bulk paste box');
assert.ok(adminUI.includes('Test this server'), 'admin UI needs a test-in-new-tab button per server');
assert.ok(read('app/movies/page.js').includes('MyListShelf'), 'the hub must show the My List shelf');
assert.ok(read('app/movies/[slug]/page.js').includes('MovieListButton'), 'the movie page needs a save-to-list button');
assert.ok(read('app/movies/[slug]/page.js').includes('servers={serverCfg.servers') && read('app/movies/[slug]/page.js').includes('getMovieServers'), 'detail page must pass the servers to the player');

const browser = read('components/MoviesBrowser.js');
assert.ok(browser.includes('/api/movies/search'), 'search box must call the world search API');
assert.ok(browser.includes('World catalogue'), 'the world results panel must exist');

const searchRoute = read('app/api/movies/search/route.js');
assert.ok(searchRoute.includes('searchWorldCatalog') && searchRoute.includes('searchMovies'), 'search API must combine local + world');
assert.ok(read('app/api/movies/servers/route.js').includes('getServersForTitle'));
ok('wiring: routes, admin panel, player, world search and the detail page are connected');

// ---------------------------------------------------------------------------------------------
// 9. Legal pages, footer, sitemap, privacy/terms
// ---------------------------------------------------------------------------------------------
const licence = read('app/licence/page.js');
const copyright = read('app/copyright/page.js');
for (const bit of ['Licence', 'TMDB', 'hls.js', 'public domain', 'play servers']) {
  assert.ok(licence.toLowerCase().includes(bit.toLowerCase()), `licence page missing ${bit}`);
}
for (const bit of ['24', '48', 'counter-notice', 'takedown']) {
  assert.ok(copyright.toLowerCase().includes(bit.toLowerCase()), `copyright page missing ${bit}`);
}
assert.ok(read('components/Footer.js').includes("['/licence'") && read('components/Footer.js').includes("['/copyright'"), 'footer must link both legal pages');
assert.ok(read('app/sitemap.js').includes("['/licence'") && read('app/sitemap.js').includes("['/copyright'"), 'sitemap must include both legal pages');
assert.ok(read('app/privacy-policy/page.js').includes('Movies, series'), 'privacy policy must explain the player');
assert.ok(read('app/terms/page.js').includes('Movies, series'), 'terms must cover the movies hub');
ok('legal: licence + copyright pages, footer, sitemap, privacy and terms all updated');

// ---------------------------------------------------------------------------------------------
// 10. Blogs, docs and release
// ---------------------------------------------------------------------------------------------
const blogs = [
  'content/blog/mizanora-v51-movies-search-play-servers-player.md',
  'content/blog/movie-play-servers-admin-guide-mizanora.md',
  'content/blog/watch-movies-on-mizanora-player-guide.md',
  'content/blog/streaming-licence-and-copyright-explained-mizanora.md',
];
for (const b of blogs) {
  assert.ok(exists(b), `missing blog ${b}`);
  const text = read(b);
  assert.ok(text.startsWith('---'), `${b} needs front matter`);
  for (const key of ['title:', 'description:', 'date:', 'category:']) assert.ok(text.includes(key), `${b} front matter missing ${key}`);
}
assert.ok(read('UPGRADE-v51.md').includes('{imdbid}'), 'UPGRADE-v51 documents the template token');
assert.ok(read('UPGRADE-v51.md').includes('Play Servers'));

const pkg = JSON.parse(read('package.json'));
assert.ok(Number(String(pkg.version).split('.')[0]) >= 51, `version should be 51 or newer, got ${pkg.version}`);
assert.ok(pkg.scripts.test.includes('test-v51.mjs'), 'v51 test is part of npm test');
ok('release: 4 guides, UPGRADE-v51.md, version 51+ and the test chain verified');

console.log(`\nAll ${pass} v51 checks passed.`);
