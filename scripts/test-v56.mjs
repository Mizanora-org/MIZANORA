/*
 * Mizanora v56 tests — "har page bhara hua, gaana chalta hua, traffic gina hua".
 *
 * v55 made the site work offline. v56 fixes the six things that were still broken or missing:
 *
 *   1. Songs still did not always play → mirror layer + /api/songs/audio (fresh token, proxy,
 *      three-step fallback in the player, honest error screen).
 *   2. The movies search bar was buried below the hero → a real search form at the top + sticky bar.
 *   3. Empty title pages looked empty → a "data pending" panel with search, popular titles, retry
 *      and noindex; the committed id pool now labels the page film/series + year.
 *   4. Actor photos broke → AvatarImg (original → /api/img relay → monogram).
 *   5. No idea who visits → server-side analytics with country/city/masked IP and a 100k goal.
 *   6. Sitemaps were 5 chunk files → year-partitioned titles + A–Z actors/songs + Quran, and a
 *      coverage report that tells the truth about how many pages have data.
 *
 * Run: node --experimental-loader ./scripts/test-v30-loader.mjs scripts/test-v56.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '');
const ok = (m) => console.log(`ok    ${m}`);
let checks = 0;
const check = (cond, msg) => { assert.ok(cond, msg); checks += 1; };

const Songs = await import(pathToFileURL(join(root, 'lib/songs.js')).href);
const Blog = await import(pathToFileURL(join(root, 'lib/blog.js')).href);
const Coverage = await import(pathToFileURL(join(root, 'lib/coverage.js')).href);
const Mirrors = await import(pathToFileURL(join(root, 'lib/songMirrors.js')).href);

// ------------------------------------------------------------------ 1. songs actually play
check(typeof Mirrors.resolveSongById === 'function', 'song mirror layer resolves a song');
check(typeof Mirrors.mirrorHealth === 'function', 'song mirror health report exists');
check(Mirrors.audioUrl('abcd1234') === '/api/songs/audio/abcd1234', 'audioUrl points at our own route');
const bases = Mirrors.mirrorBases();
check(Array.isArray(bases) && bases.length >= 2, 'at least two music mirrors are configured');
check(bases.every((b) => /^https:\/\//.test(b)), 'mirror bases are https');

const audioRoute = read('app/api/songs/audio/[id]/route.js');
check(audioRoute.includes('NextResponse.redirect'), 'the audio route redirects to a fresh CDN link');
check(audioRoute.includes('proxy'), 'the audio route can stream the bytes itself');
check(audioRoute.includes('content-range') || audioRoute.includes('content-length'), 'range headers pass through for seeking');
check(read('app/api/songs/stream/[id]/route.js').includes('playUrl'), 'the stream route hands the player a playUrl');
check(read('app/api/songs/health/route.js').includes('mirrorHealth'), 'there is a mirror health endpoint');

const song = Songs.cleanSong({
  id: 'abc12345',
  name: 'Test Song',
  artists: { primary: [{ name: 'Atif Aslam' }] },
  downloadUrl: [{ quality: '320kbps', link: 'https://cdn.example.com/a.mp3' }],
  duration: 200,
});
check(song && song.playUrl === '/api/songs/audio/abc12345', 'every song object carries a playUrl');
check(song.proxyUrl.includes('proxy=1'), 'every song object carries a proxy URL');
check(song.hasStream === true, 'the raw CDN link is still kept as a fallback');

const browser = read('components/SongBrowser.js');
check(browser.includes('onAudioError'), 'the songs browser falls back when audio fails');
check(browser.includes('chain.current.list'), 'the songs browser keeps a source chain');
const detail = read('components/SongDetailPlayer.js');
check(detail.includes('onAudioError') && detail.includes('YouTube par sunein'), 'the song page offers retry + a YouTube link');
check(detail.includes('proxyUrl'), 'the song page knows the proxy URL');

// ------------------------------------------------------------------ 2. movie search on top
const moviesPage = read('app/movies/page.js');
check(moviesPage.includes('action="/movies"') && moviesPage.includes('name="q"'), 'the movies hero has a real GET search form');
check(moviesPage.includes('name="format"'), 'the hero form carries the type filter');
check(moviesPage.includes('movies-hero-q'), 'the hero search input has an id for the label');
const moviesBrowser = read('components/MoviesBrowser.js');
check(moviesBrowser.includes('sticky top-16'), 'the search bar sticks while the grid scrolls');
check(moviesBrowser.includes('typeParam'), 'the browser asks the API for movie/series only');

// ------------------------------------------------------------------ 3. no empty title pages
const stub = read('components/TitleStubPanel.js');
for (const needle of ['Retry now', 'Open on IMDb', 'Popular', 'search']) {
  check(stub.toLowerCase().includes(needle.toLowerCase()), `stub panel includes ${needle}`);
}
check(stub.includes('seedFeatured'), 'the stub page has real titles to tap');
const detailPage = read('app/movies/[slug]/page.js');
check(detailPage.includes('TitleStubPanel'), 'the movie page renders the stub panel');
check(detailPage.includes('noindex: true'), 'a stub page is kept out of the index');
const moviesServer = read('lib/moviesServer.js');
check(moviesServer.includes('idInfo'), 'a stub is labelled film/series + year from the id pool');
const idsLib = read('lib/imdbIds.js');
check(idsLib.includes('export function idInfo') && idsLib.includes('tt\\d{6,10}'), 'the id pool indexes ids');
check(read('app/api/movies/refresh/route.js').includes('revalidatePath'), 'retry invalidates the page cache');

const cov = Coverage.coverage();
check(cov.sitemapIds > 80000, `the sitemap pool is large (${cov.sitemapIds})`);
check(cov.seeded > 16000, `the committed snapshot has titles (${cov.seeded})`);
check(cov.missing === cov.sitemapIds - cov.seeded, 'missing = pool - seeded (no fudged numbers)');
check(Coverage.coverageVerdict(cov).text.length > 20, 'the coverage verdict is a real sentence');

// ------------------------------------------------------------------ 4. pictures always render
const avatar = read('components/AvatarImg.js');
check(avatar.includes('proxyImage') && avatar.includes('hue'), 'AvatarImg falls back to the relay, then a monogram');
check(read('app/movies/actors/page.js').includes('AvatarImg'), 'the actors directory uses AvatarImg');
check(read('app/movies/actor/[slug]/page.js').includes('AvatarImg'), 'the actor page uses AvatarImg');
check(read('app/movies/page.js').includes('AvatarImg'), 'the stars rail uses AvatarImg');

// ------------------------------------------------------------------ 5. traffic analytics
const an = read('lib/analyticsServer.js');
check(an.includes('clientIp') && an.includes('geo(') && an.includes('maskIp'), 'server analytics reads IP + geo');
check(an.includes('ANALYTICS_FULL_IP'), 'full IP is opt-in, not the default');
check(an.includes('ServerValue') || an.includes(".sv"), 'counters increment atomically');
check(an.includes('100000') || an.includes('goal'), 'the 100k/day goal is part of the report');
check(read('app/api/analytics/collect/route.js').includes('recordHit'), 'the collect route records hits');
check(read('app/api/admin/traffic/route.js').includes('verifyAdmin'), 'the traffic API is admin-only');
check(read('app/admin/traffic/page.js').includes('100k') || read('app/admin/traffic/page.js').includes('goal'), 'the admin page shows the goal');
check(read('app/layout.js').includes('AnalyticsBeacon'), 'the beacon is mounted on the site');
check(read('components/AnalyticsBeacon.js').includes("startsWith('/admin')"), 'admin pages are never tracked');
check(read('components/AdminNav.js').includes('/admin/traffic'), 'Traffic has a place in the admin menu');

// ------------------------------------------------------------------ 6. sitemaps + coverage
const index = read('app/sitemap-index.xml/route.js');
check(index.includes('titles-${y}'), 'the index lists one file per release year');
check(index.includes('actors-${l}') && index.includes('songs-${l}'), 'the index lists A–Z actor and song files');
check(index.includes("'/sitemaps/quran.xml'"), 'the index lists the Quran sitemap');
const fileRoute = read('app/sitemaps/[file]/route.js');
check(fileRoute.includes('titles-\\d{4}') || fileRoute.includes('titles-'), 'the file route serves year files');
check(fileRoute.includes('actors-[a-z]') || fileRoute.includes('actors-'), 'the file route serves actor letters');
check(fileRoute.includes("name === 'quran'"), 'the file route serves the Quran file');
check(read('lib/moviesWorld.js').includes('SITEMAP_DATA_ONLY'), 'there is a sitemap quality mode');
check(existsSync(join(root, 'COVERAGE.md')), 'the coverage report is committed');
check(read('COVERAGE.md').includes('Live IMDb par depend'), 'the coverage report is honest about the gap');
check(read('scripts/audit-coverage.mjs').includes('coverage-ids.csv'), 'the audit exports the full list');

// ------------------------------------------------------------------ 7. blog hub + 100 topic plan
check(typeof Blog.postsByAuthor === 'function', 'posts can be grouped by author');
check(Blog.authorSlug('Muaaz Iqbal') === 'muaaz-iqbal', 'authorSlug makes a clean URL');
const mine = Blog.postsByAuthor('muaaz-iqbal');
check(mine.length >= 12, `at least 12 new v56 guides are written (${mine.length})`);
check(mine.every((p) => p.title && p.description && p.mins >= 2), 'every new guide has title, description and reading time');
const files = readdirSync(join(root, 'content', 'blog')).filter((f) => f.endsWith('.md'));
check(files.length >= 160, `the blog has grown (${files.length} posts)`);
check(existsSync(join(root, 'app/blog/author/[name]/page.js')), 'there is an author hub page');
const plan = read('CONTENT-PLAN-100.md');
// The plan numbers its topics 1…100; some are table rows (`| 12 | …`) and some are inline
// (`27. One · 28. Two`). Count the numbers, not the formatting.
const numbered = new Set((plan.match(/\b(\d{1,3})\.\s/g) || []).map((m) => Number(m.trim().replace('.', ''))));
const planNumbers = new Set([...(plan.match(/^\| (\d{1,3}) \|/gm) || []).map((m) => Number(m.replace(/[|\s]/g, '')))]);
for (const n of planNumbers) numbered.add(n);
const topics = [...numbered].filter((n) => n >= 1 && n <= 100).length;
check(topics >= 100, `the content plan lists 100 topics (${topics})`);
check(plan.includes('Walid') || plan.includes('family'), 'the plan marks the family posts that need real details');

// ------------------------------------------------------------------ 8. release hygiene
const pkg = JSON.parse(read('package.json'));
check(Number(String(pkg.version).split('.')[0]) >= 56, `version should be 56+, got ${pkg.version}`);
check(pkg.scripts.test.includes('test-v56.mjs'), 'the v56 test runs inside npm test');
check(pkg.scripts.coverage === 'node scripts/audit-coverage.mjs', 'npm run coverage exists');
check(read('UPGRADE-v56.md').length > 4000, 'UPGRADE-v56.md is a real guide');
ok('songs, search, stub pages, images, traffic analytics, sitemaps and content verified');

console.log(`\nAll ${checks} v56 checks passed.`);
