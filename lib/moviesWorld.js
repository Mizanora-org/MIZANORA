// Mizanora v54 — the "world catalogue" rows on /movies and the big IMDb id pool used by the
// sitemaps. Everything comes from Cinemeta (IMDb's own data, no key). Every call is defensive:
// if upstream is slow or down the page still renders with whatever the shop already has.

import { cinemetaCatalog } from './cinemeta';

import fsSync from 'node:fs';

export const WORLD_GENRES = [
  'Action', 'Comedy', 'Drama', 'Horror', 'Romance', 'Science Fiction', 'Thriller', 'Animation',
];

const PAGE = 100; // Cinemeta returns 100 metas per catalogue page
const MAX_PAGES_PER_CATALOG = 60;
const REQUEST_CAP = 420; // one sitemap build never hammers upstream more than this
const TTL = 6 * 3600 * 1000;

const rowCache = new Map();
const idCache = new Map();

const fresh = (hit) => hit && Date.now() - hit.at < TTL;

/** Catalogue rows for /movies — IMDb top movies, top series and a few genres. */
export async function getWorldRows(limit = 18) {
  const key = `rows:${limit}`;
  const hit = rowCache.get(key);
  if (fresh(hit)) return hit.value;

  const jobs = [
    cinemetaCatalog({ type: 'movie', skip: 0, timeout: 6000 }).catch(() => []),
    cinemetaCatalog({ type: 'series', skip: 0, timeout: 6000 }).catch(() => []),
    ...WORLD_GENRES.map((g) => cinemetaCatalog({ type: 'movie', genre: g, timeout: 6000 }).catch(() => [])),
  ];
  const [topMovies, topSeries, ...byGenre] = await Promise.all(jobs);

  const rows = [];
  if (topMovies.length) {
    rows.push({ key: 'imdb-top', title: 'IMDb Top Movies', blurb: 'IMDb ki apni catalogue se — har poster asal hai.', movies: topMovies.slice(0, limit) });
  }
  if (topSeries.length) {
    rows.push({ key: 'imdb-series', title: 'Top Series & Dramas', blurb: 'Duniya bhar ke series, IMDb se.', movies: topSeries.slice(0, limit) });
  }
  byGenre.forEach((list, i) => {
    if (!list.length) return;
    const genre = WORLD_GENRES[i];
    rows.push({ key: `genre-${genre}`, title: genre, blurb: 'World catalogue', movies: list.slice(0, limit) });
  });
  rowCache.set(key, { value: rows, at: Date.now() });
  return rows;
}

/**
 * A big pool of real IMDb ids for the sitemap. It walks Cinemeta's catalogue pages (top movies,
 * top series and the main genres) until `limit` ids are collected, the page budget runs out or
 * upstream stops answering. Cached for six hours, so a Google crawl does not re-walk it.
 */
export async function getWorldMovieIds(limit = 20000, opts = {}) {
  const want = Math.max(200, Math.min(500000, Number(limit) || 20000));
  // A sitemap request must answer inside the serverless limit, so the crawl gets a wall-clock
  // budget too — whatever it collected by then is cached and served, the rest comes next time.
  const budgetMs = Math.max(3000, Number(opts.budgetMs) || 20000);
  const deadline = Date.now() + budgetMs;
  const hit = idCache.get('ids');
  if (fresh(hit) && hit.ids.length >= Math.min(want, 1000)) {
    return hit.ids.slice(0, want);
  }

  const ids = [];
  const seen = new Set();
  let requests = 0;

  const catalogs = [
    { type: 'movie', catalog: 'top' },
    { type: 'series', catalog: 'top' },
    ...WORLD_GENRES.map((g) => ({ type: 'movie', catalog: 'top', genre: g })),
    ...WORLD_GENRES.map((g) => ({ type: 'series', catalog: 'top', genre: g })),
  ];

  const pagesFor = Math.max(1, Math.min(MAX_PAGES_PER_CATALOG, Math.ceil(want / (PAGE * catalogs.length)) + 2));

  const collect = (list) => {
    for (const m of list || []) {
      const id = String((m && m.imdbId) || '').toLowerCase();
      if (!/^tt\d{6,10}$/.test(id) || seen.has(id)) continue;
      seen.add(id);
      ids.push({ id, type: m.type === 'series' ? 'series' : 'movie', year: m.year || 0, title: m.title || '' });
    }
  };

  for (let page = 0; page < pagesFor; page += 1) {
    if (ids.length >= want || requests >= REQUEST_CAP || Date.now() > deadline) break;
    const chunk = catalogs.slice(0, Math.max(1, REQUEST_CAP - requests));
    const results = await Promise.all(
      chunk.map((c) => {
        requests += 1;
        return cinemetaCatalog({ type: c.type, catalog: c.catalog, genre: c.genre || '', skip: page * PAGE, timeout: 6000 }).catch(() => []);
      }),
    );
    results.forEach(collect);
    if (!results.some((r) => r && r.length)) break; // upstream has nothing more for us
  }

  // Newest first: a crawler that only reads the first sitemap still finds this year's titles.
  ids.sort((a, b) => (b.year || 0) - (a.year || 0));
  idCache.set('ids', { ids, at: Date.now() });
  return ids.slice(0, want);
}

/** Optional hand-supplied id list (a file or an admin export) merged ahead of the crawl. */
export function parseIdList(text, max = 500000) {
  const out = [];
  const seen = new Set();
  // Each line may be just "tt1234567" or "tt1234567<TAB>movie|series<TAB>2026".
  // The type column matters: series chunks are built from it.
  for (const line of String(text || '').split(/\r?\n/)) {
    const parts = String(line || '').trim().toLowerCase().split(/[\s,|]+/).filter(Boolean);
    const id = parts[0] || '';
    if (!/^tt\d{6,10}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const type = parts.slice(1).includes('series') || parts.slice(1).includes('tvseries') ? 'series' : 'movie';
    const year = Number((parts.slice(1).find((x) => /^\d{4}$/.test(x)) || 0)) || 0;
    out.push({ id, type, year, title: '' });
    if (out.length >= max) break;
  }
  return out;
}

// The IMDb dataset export can be hundreds of megabytes on disk; read it once, not once per chunk.
let idFileCache = { key: '', ids: [] };

function readIdFile(file, limit) {
  try {
    const st = fsSync.statSync(file);
    const key = `${st.size}:${st.mtimeMs}:${limit}`;
    if (idFileCache.key === key) return idFileCache.ids.slice();
    const ids = parseIdList(fsSync.readFileSync(file, 'utf8'), limit);
    idFileCache = { key, ids };
    return ids.slice();
  } catch {
    return [];
  }
}

export function clearWorldCache() {
  rowCache.clear();
  idCache.clear();
}

// ---------------------------------------------------------------------------------------------
// Sitemap helpers
// ---------------------------------------------------------------------------------------------

/** How many movie URLs the sitemap should try to cover (env can raise it to 500,000). */
export function sitemapMovieLimit() {
  const env = Number(process.env.MOVIES_SITEMAP_LIMIT);
  if (Number.isFinite(env) && env > 0) return Math.max(1000, Math.min(500000, env));
  // When the IMDb dataset has been built (data/imdb-ids.txt), the sitemap covers the whole list:
  // up to 500,000 titles in 25 chunk files. Without it we fall back to the catalogue crawl and a
  // 20,000-title default, which keeps a cold request light.
  try {
    const st = fsSync.statSync('data/imdb-ids.txt');
    if (st.size > 0) return 500000;
  } catch { /* no dataset, use the crawl */ }
  return 20000;
}

/**
 * The id pool a movie sitemap chunk is built from: ids from the shop's own hub, an optional hand
 * list (data/imdb-ids.txt) and the IMDb catalogue crawl. Deduped, newest first.
 */
export async function getSitemapIds(limit = sitemapMovieLimit()) {
  const ids = [];
  const seen = new Set();
  const push = (id, type = 'movie', extra = {}) => {
    const key = String(id || '').toLowerCase();
    if (!/^tt\d{6,10}$/.test(key) || seen.has(key)) return;
    seen.add(key);
    ids.push({ id: key, type: type === 'series' ? 'series' : 'movie', ...extra });
  };

  // 1) the IMDb list, if it exists (scripts/build-imdb-ids.mjs writes data/imdb-ids.txt).
  //    This is the path that makes a 500,000-title sitemap possible without crawling anything.
  try {
    const path = await import('node:path');
    const file = path.join(process.cwd(), 'data', 'imdb-ids.txt');
    readIdFile(file, limit).forEach((x) => push(x.id, x.type, x.year ? { year: x.year } : {}));
  } catch { /* no list, no problem */ }

  // 2) the shop's own hub (includes every upcoming title and everything the admin added)
  try {
    const { getMoviesHub } = await import('./moviesServer');
    const hub = await getMoviesHub();
    for (const m of (hub && hub.movies) || []) if (m && m.imdbId) push(m.imdbId, m.type);
  } catch { /* hub unavailable */ }

  // 3) the IMDb catalogue
  if (ids.length < limit) {
    try {
      const crawled = await getWorldMovieIds(limit, { budgetMs: 15000 });
      crawled.forEach((x) => push(x.id, x.type, { year: x.year, title: x.title }));
    } catch { /* upstream down */ }
  }

  return ids.slice(0, limit);
}

/** Split ids into sitemap-sized chunks (20,000 URLs per file keeps every file comfortably valid). */
export const SITEMAP_CHUNK = 20000;

export function chunkCount(total, size = SITEMAP_CHUNK) {
  return Math.max(1, Math.ceil(Math.max(0, Number(total) || 0) / size));
}
