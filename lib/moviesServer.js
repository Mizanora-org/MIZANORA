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
} from './movies';
import { readMoviesAll, readMoviesSecrets, writeMoviesAll } from './moviesStore';
import {
  lookupZeroKeyByImdbId,
  mapCountryLangToRegion,
  runAutoFeedDiscovery,
} from './moviesAutoFeed';

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

export async function getMoviesHub() {
  const [cfg, autoFeed] = await Promise.all([
    getMoviesConfig(),
    readLiveAutoFeed(),
  ]);
  return mergeMoviesCatalog(cfg, autoFeed.movies || [], autoFeed.actors || []);
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
    if (external) return { movie: external, movies: [external, ...movies], actors, config };
  }
  return { movie: null, movies, actors, config };
}

export async function resolveActorProfile(slugOrImdb) {
  const { config, movies, actors } = await getMoviesHub();
  if (!config.enabled) return { actor: null, movies: [], actors: [], config };
  const actor = findActor(slugOrImdb, actors);
  return { actor, movies, actors, config };
}
