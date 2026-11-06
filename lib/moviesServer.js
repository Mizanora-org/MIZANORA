import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from './firebase-admin';
import { quotaTripped } from './quota';
import { getProduct, getShopAll } from './products';
import {
  MOVIES_DEFAULT,
  cleanMovie,
  cleanMoviesConfig,
  findActor,
  findMovie,
  isValidImdbId,
  mergeMoviesCatalog,
  slugifyMovie,
  stubMovieFromImdbId,
} from './movies';
import { readMoviesAll, readMoviesSecrets, writeMoviesAll } from './moviesStore';
import { cinemetaMovie } from './cinemeta';
import { getWorldRows } from './moviesWorld';
import { seedFeatured, seedMovie, seedRows, seedSize } from './imdbSeed';
import {
  lookupPersonImage,
  lookupZeroKeyByImdbId,
  mapCountryLangToRegion,
  runAutoFeedDiscovery,
} from './moviesAutoFeed';

// ---------------------------------------------------------------------------------------------
// v51 actor portraits. Most imported cast rows arrive without a picture, which is why actor cards
// looked empty. We ask the official IMDb public suggestion endpoint once per name and remember the
// answer for half a day - the page itself stays a cached server render, so this is cheap.
// ---------------------------------------------------------------------------------------------
const photoCache = new Map();
const PHOTO_TTL = 12 * 3600 * 1000;

export async function actorPhotoLookup(name) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return '';
  const hit = photoCache.get(key);
  if (hit && Date.now() - hit.at < PHOTO_TTL) return hit.photo;
  let photo = '';
  try {
    const found = await lookupPersonImage(name);
    photo = (found && found.photo) || '';
  } catch {
    photo = '';
  }
  photoCache.set(key, { photo, at: Date.now() });
  return photo;
}

export async function enrichActorsWithPhotos(actors = [], limit = 24) {
  const list = Array.isArray(actors) ? actors : [];
  const head = list.slice(0, Math.max(0, limit));
  const enriched = await Promise.all(
    head.map(async (a) => {
      if (!a || a.photo) return a;
      const photo = await actorPhotoLookup(a.name);
      return photo ? { ...a, photo } : a;
    }),
  );
  return [...enriched, ...list.slice(head.length)];
}

export async function getEffectiveTmdbKey() {
  const envKey = String(process.env.TMDB_API_KEY || '').trim();
  if (envKey) return envKey;
  try {
    if (!adminReady() || quotaTripped()) return '';
    const sec = await readMoviesSecrets(adminDb());
    return sec.tmdbApiKey || '';
  } catch {
    return '';
  }
}

const readMoviesDoc = unstable_cache(
  async () => {
    try {
      if (!adminReady() || quotaTripped()) return cleanMoviesConfig(MOVIES_DEFAULT);
      return await readMoviesAll(adminDb());
    } catch (e) {
      console.error('movies config read failed:', e.message);
      return cleanMoviesConfig(MOVIES_DEFAULT);
    }
  },
  ['mz-movies-config-v50-sharded'],
  { revalidate: 600, tags: ['movies'] },
);

const readLiveAutoFeed = unstable_cache(
  async () => {
    // Skip external network fan-out during `next build` static generation so builds stay fast & offline-safe.
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return { movies: [], actors: [] };
    }
    try {
      const cfg = await readMoviesDoc();
      if (!cfg.enabled || (cfg.autoSync && cfg.autoSync.enabled === false)) {
        return { movies: [], actors: [] };
      }
      const tmdbApiKey = await getEffectiveTmdbKey();
      const discovered = await runAutoFeedDiscovery({
        tmdbApiKey,
        autoSync: cfg.autoSync || {},
        pagesPerFeed: 2,
        archiveRows: 8,
        timeoutMs: 3500,
      });

      // Opportunistically persist newly discovered titles into Firestore shards every 12h so sitemap & slugs grow permanently.
      if (
        discovered.movies.length > 0 &&
        adminReady() &&
        !quotaTripped() &&
        Date.now() - (Number(cfg.lastAutoSyncAt) || 0) > 12 * 3600 * 1000
      ) {
        const existingKeys = new Set(
          (cfg.customMovies || []).flatMap((m) => [m.slug, m.imdbId].filter(Boolean)),
        );
        const fresh = discovered.movies.filter(
          (m) => !existingKeys.has(m.slug) && (!m.imdbId || !existingKeys.has(m.imdbId)),
        );
        if (fresh.length > 0) {
          writeMoviesAll(adminDb(), {
            ...cfg,
            lastAutoSyncAt: Date.now(),
            customMovies: [...fresh, ...(cfg.customMovies || [])],
          }).catch(() => {});
        }
      }

      return { movies: discovered.movies || [], actors: discovered.actors || [] };
    } catch {
      return { movies: [], actors: [] };
    }
  },
  ['mz-movies-live-autofeed-v50'],
  { revalidate: 3600, tags: ['movies', 'movies-auto'] },
);

export async function getMoviesConfig() {
  return readMoviesDoc();
}

// v54 — THE CUSTOM MOVIE SYSTEM IS GONE.
//
// Until v53 the hub was "whatever somebody typed in": 180 hand-written starter entries plus the
// admin's custom movie documents. That is why a title only existed if it had been added by hand,
// and why MINEXUS (which simply reads IMDb) always had more.
//
// Now the hub is built from IMDb's own catalogue (Cinemeta):
//   * top movies, top series and the eight big genres -> the rows and the whole grid
//   * every title's slug is its IMDb id, so /movies/tt1375666 works with no catalogue entry at all
//   * old custom documents are deliberately IGNORED (customMovies/customActors are dropped below),
//     so the "custom movies" that used to be pinned to the page disappear instead of lingering
//
// The auto-feed (TMDB, when a key is configured) is only used as a fallback when Cinemeta cannot be
// reached, so an offline build still has something to show.
const HUB_TTL = 10 * 60 * 1000;
let hubCache = { at: 0, value: null };

const flattenWorldRows = (rows) => {
  const seen = new Set();
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const m of (row && row.movies) || []) {
      if (!m || !m.slug || seen.has(m.slug)) continue;
      seen.add(m.slug);
      out.push(m);
    }
  }
  return out;
};

export async function getMoviesHub() {
  const cfg = await getMoviesConfig();
  // The admin's play servers / ads / settings still come from config - only the hand-added
  // catalogue is dropped.
  const bare = { ...cfg, customMovies: [], customActors: [] };
  if (!cfg.enabled) return mergeMoviesCatalog(bare, [], []);
  if (hubCache.value && Date.now() - hubCache.at < HUB_TTL) return hubCache.value;

  // v55: the offline IMDb snapshot is ALWAYS part of the hub. Cinemeta rows come first (they are
  // fresh), then the snapshot fills in - so the catalogue is never empty offline or in a preview.
  let rows = [];
  try {
    rows = await Promise.race([
      getWorldRows(18),
      new Promise((resolve) => setTimeout(() => resolve([]), 8000)),
    ]);
  } catch { rows = []; }
  const world = flattenWorldRows(rows);
  const snapshot = seedFeatured(140);
  const merged = [];
  const seenSlug = new Set();
  for (const m of [...world, ...snapshot]) {
    if (!m || !m.slug || seenSlug.has(m.slug)) continue;
    seenSlug.add(m.slug);
    merged.push(m);
  }

  let autoFeed = { movies: [], actors: [] };
  if (!merged.length) {
    // Cinemeta and the snapshot are both unusable - last resort only. Never merges custom entries.
    try { autoFeed = await readLiveAutoFeed(); } catch { autoFeed = { movies: [], actors: [] }; }
  }

  const hub = mergeMoviesCatalog(bare, [...merged, ...((autoFeed && autoFeed.movies) || [])], (autoFeed && autoFeed.actors) || []);
  if (hub.movies.length) hubCache = { at: Date.now(), value: hub };
  return hub;
}

/** Admin "refresh catalogue" / tests: forget the merged hub so the next call re-reads Cinemeta. */
export function clearMoviesHubCache() {
  hubCache = { at: 0, value: null };
}

// Companion shop product cards shown alongside the cinema/trailer player.
export async function getMovieCompanionProducts(slugs = [], seed = 'movies', limit = 4) {
  try {
    const picked = [...new Set((slugs || []).filter(Boolean))].slice(0, limit);
    if (picked.length > 0) {
      const rows = await Promise.all(
        picked.map(async (s) => {
          try {
            const p = await getProduct(s);
            if (!p || p.inStock === false || !p.name || !(p.price > 0)) return null;
            return {
              slug: p.slug,
              name: p.name.slice(0, 90),
              image: (p.images && p.images[0]) || p.image || '',
              price: p.price,
              comparePrice: p.comparePrice > p.price ? p.comparePrice : 0,
            };
          } catch {
            return null;
          }
        }),
      );
      const valid = rows.filter(Boolean);
      if (valid.length > 0) return valid;
    }

    const all = await getShopAll();
    const ok = (all || []).filter((p) => p && p.inStock !== false && p.price > 0 && ((p.images && p.images[0]) || p.image));
    if (!ok.length) return [];
    const h = [...String(seed || 'mz')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 11);
    const start = h % ok.length;
    const out = [];
    for (let i = 0; i < ok.length && out.length < limit; i += 1) {
      const p = ok[(start + i * 5) % ok.length];
      if (!out.some((x) => x.slug === p.slug)) {
        out.push({
          slug: p.slug,
          name: String(p.name || '').slice(0, 90),
          image: (p.images && p.images[0]) || p.image || '',
          price: p.price,
          comparePrice: p.comparePrice > p.price ? p.comparePrice : 0,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function tmdbAuthUrl(pathWithQuery, apiKey) {
  const isBearer = apiKey.startsWith('eyJ') || apiKey.length > 64;
  const sep = pathWithQuery.includes('?') ? '&' : '?';
  return {
    url: isBearer
      ? `https://api.themoviedb.org/3/${pathWithQuery}`
      : `https://api.themoviedb.org/3/${pathWithQuery}${sep}api_key=${encodeURIComponent(apiKey)}`,
    headers: isBearer ? { Authorization: `Bearer ${apiKey}` } : {},
  };
}

// Official metadata lookup by IMDb ID (tt...):
//   1. Uses TMDB v3/v4 (cast, official YouTube trailer, watch providers) when key is configured.
//   2. Automatically falls back to Zero-Key Official Lookup (TVmaze + IMDb Public Suggestion JSON) so it works out-of-the-box!
export async function lookupOfficialByImdbId(rawImdbId, explicitKey = '') {
  const imdbId = String(rawImdbId || '').trim().toLowerCase();
  if (!isValidImdbId(imdbId)) return null;
  // v54: IMDb's own catalogue first (Cinemeta, zero key). Every tt-ID with a real poster,
  // synopsis, rating, cast and episode list — no "pending details" placeholder needed.
  try {
    const cinema = await cinemetaMovie(imdbId);
    if (cinema) return cinema;
  } catch { /* fall through to the snapshot / TMDB / zero-key */ }

  // v55: Cinemeta did not answer (offline preview, slow upstream). The committed IMDb snapshot
  // still has the poster, rating, cast, synopsis and genres for 16,000+ films and ~900 series.
  const snap = seedMovie(imdbId);
  if (snap) return snap;

  const apiKey = String(explicitKey || '').trim() || (await getEffectiveTmdbKey());

  if (apiKey) {
    try {
      const findReq = tmdbAuthUrl(`find/${encodeURIComponent(imdbId)}?external_source=imdb_id`, apiKey);
      const findRes = await fetch(findReq.url, {
        headers: findReq.headers,
        signal: AbortSignal.timeout(7000),
        next: { revalidate: 86400 },
      });
      if (findRes.ok) {
        const findData = await findRes.json();
        const movieHit = (findData.movie_results || [])[0];
        const tvHit = !movieHit ? (findData.tv_results || [])[0] : null;
        const hit = movieHit || tvHit;
        if (hit && hit.id) {
          const kind = movieHit ? 'movie' : 'tv';
          const detailReq = tmdbAuthUrl(`${kind}/${hit.id}?append_to_response=credits,videos,watch/providers`, apiKey);
          const detailRes = await fetch(detailReq.url, {
            headers: detailReq.headers,
            signal: AbortSignal.timeout(7000),
            next: { revalidate: 86400 },
          });
          if (detailRes.ok) {
            const d = await detailRes.json();
            const title = d.title || d.name || '';
            const releaseDate = d.release_date || d.first_air_date || '';
            const year = releaseDate ? Number(releaseDate.slice(0, 4)) : new Date().getFullYear();
            const countries = (d.production_countries || []).map((c) => c.iso_3166_1 || c.name).filter(Boolean);
            const region = mapCountryLangToRegion(
              (d.production_countries || []).map((c) => c.iso_3166_1).concat(d.origin_country || []),
              d.original_language,
            );
            const vids = (d.videos && d.videos.results) || [];
            const ytTrailer =
              vids.find((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ||
              vids.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ||
              vids.find((v) => v.site === 'YouTube' && v.type === 'Teaser');

            const wp = (d['watch/providers'] && d['watch/providers'].results) || {};
            const regionPack = wp.PK || wp.IN || wp.US || null;
            const legalProviders = [];
            if (regionPack && regionPack.link) {
              const names = [
                ...(regionPack.flatrate || []),
                ...(regionPack.free || []),
                ...(regionPack.rent || []),
              ]
                .map((p) => p.provider_name)
                .filter(Boolean);
              for (const name of [...new Set(names)].slice(0, 4)) {
                legalProviders.push({
                  name,
                  kind: 'Legal Streaming',
                  url: regionPack.link,
                  region: wp.PK ? 'PK' : wp.IN ? 'IN' : 'Global',
                });
              }
            }
            legalProviders.push({
              name: 'IMDb Official Page',
              kind: 'Official Info',
              url: `https://www.imdb.com/title/${imdbId}/`,
              region: 'Global',
            });

            const directors = ((d.credits && d.credits.crew) || [])
              .filter((c) => c.job === 'Director')
              .map((c) => c.name)
              .slice(0, 2);

            const todayIso = new Date().toISOString().slice(0, 10);
            const built = cleanMovie({
              slug: `${slugifyMovie(title)}-${year || imdbId}`,
              imdbId,
              title,
              originalTitle: d.original_title || d.original_name || '',
              type: kind === 'tv' ? 'series' : 'movie',
              year,
              releaseDate,
              status: releaseDate && releaseDate > todayIso ? 'upcoming' : 'released',
              region,
              country: ((d.production_countries || []).map((c) => c.name).join(', ')) || countries.join(', ') || region,
              language: ((d.spoken_languages || []).map((l) => l.english_name || l.name).filter(Boolean).join(', ')) || d.original_language || 'English',
              genres: (d.genres || []).map((g) => g.name),
              rating: d.vote_average || 0,
              runtime: d.runtime || ((d.episode_run_time || [])[0] || 0),
              tagline: d.tagline || '',
              story: d.overview || '',
              director: directors.join(', ') || ((d.created_by || []).map((c) => c.name).join(', ')),
              poster: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : '',
              backdrop: d.backdrop_path ? `https://image.tmdb.org/t/p/w1280${d.backdrop_path}` : '',
              cast: ((d.credits && d.credits.cast) || []).slice(0, 14).map((c) => ({
                slug: slugifyMovie(c.name),
                name: c.name,
                character: c.character || '',
                photo: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : '',
              })),
              trailerYoutubeId: ytTrailer ? ytTrailer.key : '',
              legalProviders,
              seasons: kind === 'tv'
                ? (d.seasons || [])
                    .filter((s) => s.season_number > 0)
                    .slice(0, 12)
                    .map((s) => ({
                      season: s.season_number,
                      title: `${s.name || `Season ${s.season_number}`} (${s.episode_count || 0} Episodes)`,
                      year: s.air_date ? Number(s.air_date.slice(0, 4)) : year,
                      episodes: [
                        {
                          e: 1,
                          title: `${s.name || `Season ${s.season_number}`} Overview`,
                          runtime: (d.episode_run_time || [])[0] || 45,
                          airDate: s.air_date || '',
                          summary: s.overview || `${s.episode_count || ''} official episodes in ${s.name || `Season ${s.season_number}`}.`,
                        },
                      ],
                    }))
                : [],
              keywords: `${title} ${imdbId} ${region}`.toLowerCase(),
            });
            if (built) return built;
          }
        }
      }
    } catch (e) {
      console.error('TMDB official lookup failed, falling back to zero-key lookup:', e.message);
    }
  }

  // Zero-key official fallback (TVmaze + IMDb Official Public Suggestion JSON)
  return lookupZeroKeyByImdbId(imdbId);
}

export async function resolveMovieOrSeries(slugOrImdb) {
  const { config, movies, actors } = await getMoviesHub();
  if (!config.enabled) return { movie: null, movies: [], actors: [], config };
  const found = findMovie(slugOrImdb, movies);
  if (found) return { movie: found, movies, actors, config };
  if (isValidImdbId(slugOrImdb)) {
    const external = await lookupOfficialByImdbId(slugOrImdb);
    if (external) {
      // v54: Cinemeta knows the cast names but not their faces; the IMDb public portrait lookup
      // (already cached) fills the first few so the detail page shows real people, not initials.
      let movie = external;
      if (external.cinemeta && Array.isArray(external.cast) && external.cast.length) {
        const head = await Promise.all(
          external.cast.slice(0, 6).map(async (c) => (c.photo ? c : { ...c, photo: await actorPhotoLookup(c.name).catch(() => '') })),
        );
        movie = { ...external, cast: [...head, ...external.cast.slice(6)] };
      }
      return { movie, movies: [movie, ...movies], actors, config };
    }
    // Metadata could not be fetched: keep the page (and its play servers) alive instead of a 404.
    const stub = stubMovieFromImdbId(slugOrImdb);
    if (stub) return { movie: stub, movies: [stub, ...movies], actors, config };
  }
  return { movie: null, movies, actors, config };
}

export async function resolveActorProfile(slugOrImdb) {
  const { config, movies, actors } = await getMoviesHub();
  if (!config.enabled) return { actor: null, movies: [], actors: [], config };
  const actor = findActor(slugOrImdb, actors);
  if (actor && !actor.photo) {
    const photo = await actorPhotoLookup(actor.name);
    if (photo) return { actor: { ...actor, photo }, movies, actors, config };
  }
  return { actor, movies, actors, config };
}
