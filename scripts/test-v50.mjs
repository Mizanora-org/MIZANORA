// Mizanora v50 tests — Legal Movies & Series Discovery Hub, Auto-IMDb/TMDB/TVmaze/Archive Sync,
// Sharded Firestore Store, Official Trailers, Cast/Actors, Release Calendar, Public-Domain Player,
// Anti-Piracy Stream Guards, SEO Sitemap & Product Ads.
// Run: node scripts/test-v50.mjs (wired into `npm test`)

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

const M = await imp('lib/movies.js');
const Store = await imp('lib/moviesStore.js');
const Auto = await imp('lib/moviesAutoFeed.js');
const S = await imp('lib/siteSearch.js');
const B = await imp('lib/blog.js');

// 1. Starter catalog, regional coverage & newest-to-oldest + upcoming ordering
const { movies, actors, config } = M.mergeMoviesCatalog();
assert.equal(config.enabled, true);
assert.equal(config.autoSync.enabled, true, 'autoSync is ON by default');
assert.ok(movies.length >= 65, `expected >= 65 starter titles, got ${movies.length}`);
assert.equal(new Set(movies.map((m) => m.slug)).size, movies.length, 'unique movie slugs');
assert.ok(actors.length >= 35, `expected >= 35 starter+backfilled actors, got ${actors.length}`);
assert.equal(new Set(actors.map((a) => a.slug)).size, actors.length, 'unique actor slugs');

// Verify newest-to-oldest ("nayi se porani + ane wali") default ordering
assert.ok(movies[0].year >= 2027 && movies[movies.length - 1].year <= 1930, 'movies ordered from 2027 upcoming down to 1920s classics');

for (const region of ['Pakistan', 'India', 'Iran & Afghanistan', 'Bangladesh', 'Turkey & Arabic', 'International']) {
  assert.ok(movies.some((m) => m.region === region), `catalog covers region: ${region}`);
}
for (const country of ['Pakistan', 'India', 'Bangladesh', 'Iran', 'Iraq', 'Afghanistan']) {
  assert.ok(movies.some((m) => m.country.includes(country)), `catalog covers target country: ${country}`);
}
assert.ok(movies.some((m) => m.type === 'movie') && movies.some((m) => m.type === 'series'), 'both movies and series exist');
assert.ok(movies.filter((m) => m.status === 'upcoming').length >= 12, 'upcoming release calendar has >= 12 entries');
assert.ok(movies.filter((m) => Boolean(m.publicDomainStream)).length >= 7, 'public-domain legal full films exist');
ok(`catalog: ${movies.length} titles & ${actors.length} actors ordered 2027 Upcoming → Classics across PK, IN, BD, IR, IQ, AF & World`);

// 2. Every cast member on every movie resolves to a valid actor profile (zero 404 cast links)
for (const m of movies) {
  for (const c of m.cast || []) {
    const found = M.findActor(c.slug, actors);
    assert.ok(found, `cast member ${c.slug} in ${m.slug} resolves in actors`);
  }
}
ok('actors: every cast member in every movie resolves to a profile and filmography');

// 3. Strict anti-piracy & legal stream security guards
const blockedUrls = [
  'https://slast430did.com/play/tt1375666',
  'https://slast430did.com/play/tt1375666?s=1&e=1',
  'https://77.72.20.146/play/tt1375666.mp4',
  'https://vidsrc.to/embed/movie/tt1375666',
  'https://2embed.cc/embed/tt1375666',
  'https://movierulz.example/stream.mp4',
  'https://indstream.example/play/tt1375666.m3u8',
  'https://allmovieland.example/video.mp4',
  'https://anyhost.example/play/tt1375666',
  'http://archive.org/download/Charade1963/Charade1963_512kb.mp4',
  'https://127.0.0.1/film.mp4',
  'https://localhost/film.m3u8',
  'https://user:pass@archive.org/download/a/b.mp4',
];
for (const bad of blockedUrls) {
  assert.equal(M.isForbiddenStreamUrl(bad), true, `must block ${bad}`);
  assert.equal(M.cleanLegalStream({ url: bad, license: 'Public Domain', licenseType: 'public-domain', rightsConfirmed: true }), null, `cleanLegalStream must reject ${bad}`);
  assert.equal(M.cleanProviderLink({ name: 'Bad', url: bad }), null, `cleanProviderLink must reject ${bad}`);
}
assert.equal(M.cleanLegalStream({ url: 'https://example.com/watch-movie-page', license: 'Public Domain', licenseType: 'public-domain' }), null);
assert.equal(M.cleanLegalStream({ url: 'https://cdn.example.com/owned.mp4', license: '', rightsConfirmed: false }), null);
const validPd = M.cleanLegalStream({ url: 'https://archive.org/download/Charade1963/Charade1963_512kb.mp4', license: 'Public Domain (1963)', licenseType: 'public-domain' });
assert.ok(validPd && validPd.isHls === false);
const validHls = M.cleanLegalStream({ url: 'https://cdn.example.com/legal/master.m3u8', license: 'Mizanora Licensed Stream', licenseType: 'owned-licensed', rightsConfirmed: true });
assert.ok(validHls && validHls.isHls === true);
assert.equal(M.youtubeEmbedUrl('YoHD9XEInc0'), 'https://www.youtube-nocookie.com/embed/YoHD9XEInc0?rel=0&modestbranding=1&playsinline=1');
assert.equal(M.youtubeEmbedUrl('bad"onload=1'), '');
ok('security: unauthorized/pirate hosts, IP hosts, non-HTTPS, and unconfirmed streams are strictly rejected');

// 4. IMDb ID resolution, bulk IMDb extraction, search, filmography & release calendar
assert.deepEqual(
  M.extractImdbIds('Check https://www.imdb.com/title/tt1375666/ and TT15398776, plus tt1375666 duplicate!'),
  ['tt1375666', 'tt15398776'],
);
const inc = M.findMovie('tt1375666', movies);
assert.ok(inc && inc.slug === 'inception-2010', 'tt1375666 resolves to Inception');
const mj = M.findMovie('tt4139928', movies);
assert.ok(mj && mj.slug === 'the-legend-of-maula-jatt', 'tt4139928 resolves to Maula Jatt');
assert.equal(M.searchMovies('tt1375666', movies)[0].slug, 'inception-2010');
assert.ok(M.searchMovies('Fawad Khan', movies).some((m) => m.slug === 'the-legend-of-maula-jatt'));
assert.ok(M.searchMovies('', movies, { freeOnly: true }).every((m) => Boolean(m.publicDomainStream)));
assert.ok(M.searchMovies('', movies, { region: 'Pakistan' }).every((m) => m.region === 'Pakistan'));

const fawad = M.findActor('fawad-khan', actors);
assert.ok(fawad && M.actorFilmography(fawad, movies).length >= 4, 'Fawad Khan filmography populated');
const cal = M.buildReleaseCalendar(movies, { includeRecent: false, refDate: '2026-11-05' });
assert.ok(cal.length >= 5 && cal.every((g) => g.items.length >= 1), 'release calendar groups upcoming titles by month');
assert.equal(M.daysUntilRelease('2026-11-27', '2026-11-05'), 22);
ok('lookup, bulk IMDb extractor, filters, filmography & release calendar verified');

// 5. Auto-Feed Discovery Engine (TMDB + TVmaze + IMDb Public JSON + Internet Archive + Bulk Sync)
const mockFetch = async (url) => {
  const u = String(url);
  if (u.includes('api.themoviedb.org/3/')) {
    return {
      ok: true,
      json: async () => ({
        results: [
          {
            id: 901,
            title: 'Lahore Skyline 2027',
            release_date: '2027-08-14',
            origin_country: ['PK'],
            original_language: 'ur',
            genre_ids: [28, 18],
            vote_average: 0,
            overview: 'Upcoming Pakistani action drama.',
            poster_path: '/lahore2027.jpg',
          },
          {
            id: 902,
            title: 'Tehran Midnight Express',
            release_date: '2025-10-10',
            origin_country: ['IR'],
            original_language: 'fa',
            genre_ids: [53, 18],
            vote_average: 8.1,
            overview: 'Latest Iranian thriller.',
            poster_path: '/tehran.jpg',
          },
        ],
      }),
    };
  }
  if (u.includes('api.tvmaze.com/lookup/shows?imdb=tt9988776')) {
    return {
      ok: true,
      json: async () => ({
        id: 77,
        name: 'Karachi Harbour Chronicles',
        premiered: '2026-04-12',
        status: 'Running',
        language: 'Urdu',
        genres: ['Drama', 'Crime'],
        rating: { average: 8.4 },
        externals: { imdb: 'tt9988776' },
        image: { original: 'https://static.tvmaze.com/uploads/images/karachi.jpg' },
        summary: '<p>Official Urdu mystery drama.</p>',
      }),
    };
  }
  if (u.includes('api.tvmaze.com/lookup/shows')) {
    return { ok: false, json: async () => null };
  }
  if (u.includes('api.tvmaze.com/shows/77/cast')) {
    return {
      ok: true,
      json: async () => [{ person: { name: 'Fawad Khan' }, character: { name: 'Captain Zafar' } }],
    };
  }
  if (u.includes('api.tvmaze.com/')) {
    return {
      ok: true,
      json: async () => [
        {
          show: {
            id: 88,
            name: 'Dhaka River Lights',
            premiered: '2027-02-01',
            status: 'In Development',
            language: 'Bangla',
            genres: ['Drama'],
            network: { name: 'Chorki', country: { code: 'BD', name: 'Bangladesh' } },
            externals: { imdb: 'tt8877665' },
            summary: '<p>Upcoming Bangladeshi series.</p>',
          },
        },
      ],
    };
  }
  if (u.includes('v3.sg.media-imdb.com/suggestion/')) {
    return {
      ok: true,
      json: async () => ({
        d: [
          {
            id: 'tt7766554',
            l: 'Baghdad Dawn',
            y: 2026,
            qid: 'movie',
            s: 'Suhail Dabbach, Zahraa Ghandour',
            i: { imageUrl: 'https://m.media-amazon.com/images/M/baghdad.jpg' },
          },
        ],
      }),
    };
  }
  if (u.includes('archive.org/advancedsearch.php')) {
    return {
      ok: true,
      json: async () => ({
        response: {
          docs: [{ identifier: 'VoyageMoon1902', title: 'A Trip to the Moon', year: '1902', creator: 'Georges Melies', description: 'Silent classic.' }],
        },
      }),
    };
  }
  if (u.includes('archive.org/metadata/VoyageMoon1902/files')) {
    return {
      ok: true,
      json: async () => ({ result: [{ name: 'VoyageMoon1902_512kb.mp4' }] }),
    };
  }
  return { ok: false, json: async () => null };
};

const autoRun = await Auto.runAutoFeedDiscovery({ tmdbApiKey: 'test_key', fetchFn: mockFetch });
assert.ok(autoRun.movies.some((m) => m.slug === 'lahore-skyline-2027-2027' && m.status === 'upcoming' && m.region === 'Pakistan'));
assert.ok(autoRun.movies.some((m) => m.slug === 'tehran-midnight-express-2025' && m.region === 'Iran & Afghanistan'));
assert.ok(autoRun.movies.some((m) => m.imdbId === 'tt8877665' && m.region === 'Bangladesh'));
assert.ok(autoRun.movies.some((m) => m.slug === 'a-trip-to-the-moon-1902' && m.publicDomainStream));

const zkSeries = await Auto.lookupZeroKeyByImdbId('tt9988776', { fetchFn: mockFetch });
assert.ok(zkSeries && zkSeries.title === 'Karachi Harbour Chronicles' && zkSeries.cast.length === 1);
const zkImdb = await Auto.lookupZeroKeyByImdbId('tt7766554', { fetchFn: mockFetch });
assert.ok(zkImdb && zkImdb.title === 'Baghdad Dawn' && zkImdb.imdbId === 'tt7766554');

const bulkRes = await Auto.bulkResolveImdbIds('Paste: tt9988776 and tt7766554', { fetchFn: mockFetch });
assert.equal(bulkRes.movies.length, 2);
ok('auto-feed: TMDB, zero-key TVmaze, zero-key IMDb JSON, Internet Archive & bulk IMDb importer verified');

// 6. Sharded Firestore Store (handles hundreds/thousands of auto-synced titles + server-only secrets)
function makeMockFirestore() {
  const store = new Map();
  const docApi = (key) => ({
    get: async () => ({
      exists: store.has(key),
      id: key.split('/').pop(),
      data: () => (store.has(key) ? structuredClone(store.get(key)) : undefined),
    }),
    set: async (val, opts) => {
      const prev = opts && opts.merge && store.has(key) ? store.get(key) : {};
      store.set(key, structuredClone(opts && opts.merge ? { ...prev, ...val } : val));
    },
    delete: async () => { store.delete(key); },
    collection: (sub) => colApi(`${key}/${sub}`),
  });
  const colApi = (prefix) => ({
    doc: (id) => docApi(`${prefix}/${id}`),
    get: async () => {
      const docs = [];
      for (const [k, v] of store.entries()) {
        if (k.startsWith(`${prefix}/`) && !k.slice(prefix.length + 1).includes('/')) {
          docs.push({ id: k.slice(prefix.length + 1), data: () => structuredClone(v) });
        }
      }
      return { docs };
    },
  });
  return {
    store,
    collection: (name) => colApi(name),
    batch: () => {
      const ops = [];
      return {
        set: (ref, val) => ops.push(() => ref.set(val)),
        delete: (ref) => ops.push(() => ref.delete()),
        commit: async () => { for (const fn of ops) await fn(); },
      };
    },
  };
}

const mockDb = makeMockFirestore();
const manyMovies = Array.from({ length: 420 }, (_, i) => ({
  title: `Synced Film ${i + 1}`,
  year: 2026 - (i % 30),
  type: i % 3 === 0 ? 'series' : 'movie',
  region: i % 2 === 0 ? 'Pakistan' : 'International',
}));
const writeRes = await Store.writeMoviesAll(mockDb, { ...M.MOVIES_DEFAULT, customMovies: manyMovies });
assert.ok(writeRes.parts >= 3, `420 movies split across ${writeRes.parts} shards`);
const readBack = await Store.readMoviesAll(mockDb);
assert.equal(readBack.customMovies.length, 420, 'all 420 sharded movies read back intact');

// Shrinking list deletes stale shards
const shrinkRes = await Store.writeMoviesAll(mockDb, { ...M.MOVIES_DEFAULT, customMovies: manyMovies.slice(0, 10) });
assert.equal(shrinkRes.parts, 1);
assert.ok(shrinkRes.removed >= 2, 'stale shards removed when list shrinks');

await Store.writeMoviesSecrets(mockDb, { tmdbApiKey: 'secret_tmdb_12345' });
assert.equal((await Store.readMoviesSecrets(mockDb)).tmdbApiKey, 'secret_tmdb_12345');
ok('sharded store: 420+ titles shard/read/shrink cleanly & TMDB secret stays isolated in adminSecrets');

// 7. Site-wide search integration
const sr1 = S.siteSearch('tt1375666', {});
assert.ok(sr1.movies.some((m) => m.slug === 'inception-2010'), 'siteSearch finds movie by IMDb ID');
const sr2 = S.siteSearch('Parizaad', {});
assert.ok(sr2.movies.some((m) => m.slug === 'parizaad'), 'siteSearch finds Pakistani drama');
const sr3 = S.siteSearch('Mahira Khan', {});
assert.ok(sr3.actors.some((a) => a.slug === 'mahira-khan'), 'siteSearch finds actor');
ok('siteSearch: returns matching movies, dramas, IMDb IDs and actors');

// 8. Routes, components, sitemap, firestore.rules, llms.txt & product ads
const requiredFiles = [
  'lib/moviesCatalog.js',
  'lib/movies.js',
  'lib/moviesStore.js',
  'lib/moviesAutoFeed.js',
  'lib/moviesServer.js',
  'components/MoviePosterCard.js',
  'components/CinemaPlayer.js',
  'components/MoviesBrowser.js',
  'components/MoviesCalendarClient.js',
  'components/MoviesStrip.js',
  'app/movies/page.js',
  'app/movies/[slug]/page.js',
  'app/movies/calendar/page.js',
  'app/movies/actors/page.js',
  'app/movies/actor/[slug]/page.js',
  'app/api/movies/route.js',
  'app/api/admin/movies/route.js',
  'app/admin/movies/page.js',
];
for (const f of requiredFiles) assert.ok(exists(f), `exists: ${f}`);

for (const page of [
  'app/movies/page.js',
  'app/movies/[slug]/page.js',
  'app/movies/calendar/page.js',
  'app/movies/actors/page.js',
  'app/movies/actor/[slug]/page.js',
  'app/blog/[slug]/page.js',
  'app/blog/page.js',
]) {
  const txt = read(page);
  assert.ok(txt.includes('ProductAds') && txt.includes('AdsInject'), `${page} mounts both ProductAds and AdsInject`);
}
assert.ok(read('app/blog/[slug]/page.js').includes('MoviesStrip'), 'blog post page auto-mounts MoviesStrip');
assert.ok(read('app/page.js').includes('MoviesStrip'), 'home page mounts MoviesStrip');
assert.ok(read('components/Header.js').includes('href="/movies"'), 'Header links to /movies');
assert.ok(read('components/Footer.js').includes("['/movies', 'Movies & Series']"), 'Footer links to /movies');
assert.ok(read('components/HomeHub.js').includes("href: '/movies'"), 'HomeHub links to /movies');
assert.ok(read('components/AdminNav.js').includes("'/admin/movies'"), 'AdminNav links to /admin/movies');
assert.ok(read('components/SiteGate.js').includes("'/movies'"), 'SiteGate keeps /movies open');
assert.ok(read('app/api/admin/movies/route.js').includes('verifyAdmin'), 'Admin movies API is admin-gated');
assert.ok(read('firestore.rules').includes('match /siteMeta/{id}/parts/{part}'), 'firestore.rules protects movie shards');

const sm = read('app/sitemap.js');
assert.ok(
  sm.includes("'/movies'") &&
    sm.includes("'/movies/calendar'") &&
    sm.includes("'/movies/actors'") &&
    sm.includes('/movies/actor/') &&
    sm.includes('/blog/category/'),
  'sitemap advertises movies, calendar, actors & blog categories',
);
assert.ok(read('app/llms.txt/route.js').includes('/movies'), 'llms.txt advertises /movies');
ok('wiring: routes, Header, Footer, HomeHub, AdminNav, SiteGate, Sitemap, Rules, llms.txt & ProductAds verified');

// 9. New SEO blog guides
const expectedGuides = [
  'mizanora-movies-and-series-hub-trailers-cast-calendar',
  'best-pakistani-movies-and-dramas-watch-guide-2026',
  'upcoming-movies-release-calendar-2026-2027-pakistan-india-world',
  'watch-classic-public-domain-movies-legally-online-free',
];
for (const slug of expectedGuides) {
  const post = B.getPost(slug);
  assert.ok(post && post.category === 'movies-and-series' && post.words >= 280, `guide ${slug} published in movies-and-series`);
}
ok('blogs: 4 new Movies & Series guides published with clean internal links');

const pkg = JSON.parse(read('package.json'));
assert.ok(Number(String(pkg.version).split('.')[0]) >= 50, `v50 or later, got ${pkg.version}`);
assert.ok(pkg.scripts.test.includes('test-v50.mjs'));
assert.ok(exists('UPGRADE-v50.md'));
ok('release: version 50+, test chain & UPGRADE-v50.md verified');

console.log(`\nAll ${pass} v50 checks passed.`);
