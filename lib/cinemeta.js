// Mizanora v54 — Cinemeta is the IMDb catalogue that needs no API key.
//
// MINEXUS (and most Stremio-style apps) load every movie/series from
//   https://v3-cinemeta.strem.io/meta/{movie|series}/{ttID}.json
//   https://v3-cinemeta.strem.io/catalog/{movie|series}/top[/skip=100].json
// Cinemeta mirrors IMDb's own data (title, year, poster, backdrop, synopsis, genres, rating,
// runtime, cast, episodes) and the poster CDN at images.metahub.space needs no key either.
// That is why MIZANORA no longer needs a "custom movie" with a fake title: every tt-ID gets a
// real page.
//
// Everything here is defensive: a missing field never throws, a dead upstream returns null and
// the caller falls back to whatever it had before.

import { cleanMovie } from './movies';

export const CINEMETA_BASE = 'https://v3-cinemeta.strem.io';
export const METAHUB_BASE = 'https://images.metahub.space';
export const CINEMETA_TTL = 6 * 3600 * 1000; // 6 hours in memory
const TIMEOUT = 6500;

const cache = new Map();

const getJson = async (url, fetcher, timeout) => {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CINEMETA_TTL) return hit.value;
  const doFetch = typeof fetcher === 'function' ? fetcher : globalThis.fetch;
  if (typeof doFetch !== 'function') return null;
  let ctrl = null;
  let timer = null;
  try {
    ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (ctrl) timer = setTimeout(() => ctrl.abort(), timeout);
    const res = await doFetch(url, ctrl ? { signal: ctrl.signal, headers: { accept: 'application/json' } } : { headers: { accept: 'application/json' } });
    if (!res || !res.ok) return null;
    const value = await res.json();
    cache.set(url, { value, at: Date.now() });
    if (cache.size > 600) { // keep the map from growing forever
      const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 100);
      oldest.forEach(([k]) => cache.delete(k));
    }
    return value;
  } catch (_) {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/** "2010–2015" -> 2010, "2026" -> 2026, "" -> 0 */
export function cinemetaYear(releaseInfo) {
  const m = String(releaseInfo || '').match(/(18|19|20)\d{2}/);
  return m ? Number(m[0]) : 0;
}

/** "148 min" -> 148, "2h 16min" -> 136, "" -> 0 */
export function cinemetaRuntime(value) {
  const s = String(value || '').toLowerCase();
  if (!s) return 0;
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*m/);
  const mins = (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
  if (mins) return mins;
  const bare = s.match(/^\s*(\d+)\s*$/);
  return bare ? Number(bare[1]) : 0;
}

/** the official Metahub poster exists for every IMDb title that has one. */
export function cinemetaPoster(meta, size = 'medium') {
  const id = String((meta && (meta.imdb_id || meta.id)) || '').trim();
  const own = String((meta && meta.poster) || '').trim();
  if (/^https:\/\//i.test(own)) return own;
  return id && /^tt\d+/.test(id) ? `${METAHUB_BASE}/poster/${size}/${id}/img` : '';
}

export function cinemetaBackdrop(meta) {
  const own = String((meta && meta.background) || '').trim();
  if (/^https:\/\//i.test(own)) return own;
  const id = String((meta && (meta.imdb_id || meta.id)) || '').trim();
  return id && /^tt\d+/.test(id) ? `${METAHUB_BASE}/background/medium/${id}/img` : '';
}

/** The first YouTube trailer id (Cinemeta's trailers[] is sometimes a string). */
export function cinemetaTrailer(meta) {
  const list = Array.isArray(meta && meta.trailers) ? meta.trailers : [];
  for (const t of list) {
    if (t && t.source === 'YouTube' && /^[\w-]{11}$/.test(String(t.youtubeId || ''))) return String(t.youtubeId);
  }
  return '';
}

/** Cast names (Cinemeta sends strings; some mirrors send {name}). */
export function cinemetaCast(meta, max = 24) {
  const raw = Array.isArray(meta && meta.cast) ? meta.cast : [];
  return raw
    .map((c) => String(typeof c === 'string' ? c : (c && (c.name || c.actor)) || '').trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, max)
    .map((name) => ({ name }));
}

/** Cinemeta videos -> the seasons[] shape lib/movies.js already understands. */
export function episodesFromCinemeta(meta) {
  const videos = Array.isArray(meta && meta.videos) ? meta.videos : [];
  if (!videos.length) return [];
  const bySeason = new Map();
  for (const v of videos) {
    const season = Math.max(1, Number(v && (v.season ?? v.seasonNumber)) || 1);
    const ep = Math.max(1, Number(v && (v.number ?? v.episode ?? v.episodeNumber)) || 1);
    if (!bySeason.has(season)) bySeason.set(season, new Map());
    const list = bySeason.get(season);
    if (list.has(ep)) continue;
    list.set(ep, {
      e: ep,
      title: String((v && (v.name || v.title)) || `Episode ${ep}`).trim().slice(0, 120),
      runtime: 0,
      airDate: /^\d{4}-\d{2}-\d{2}/.test(String((v && (v.released || v.firstAired)) || '')) ? String(v.released || v.firstAired).slice(0, 10) : '',
      summary: String((v && (v.overview || v.description)) || '').trim().slice(0, 360),
    });
  }
  return [...bySeason.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(0, 30)
    .map(([season, eps]) => ({
      season,
      title: `Season ${season}`,
      year: cinemetaYear(meta.releaseInfo) || new Date().getFullYear(),
      episodes: [...eps.values()].sort((a, b) => a.e - b.e).slice(0, 120),
    }));
}

/**
 * One Cinemeta meta -> a MOVIES card that the rest of MIZANORA already knows how to render.
 * The slug is the IMDb id on purpose: `tt1234567` never changes, while a title's spelling can.
 */
export function movieFromCinemeta(meta, type = 'movie') {
  if (!meta || typeof meta !== 'object') return null;
  const id = String(meta.imdb_id || meta.id || '').trim().toLowerCase();
  if (!/^tt\d{6,10}$/.test(id)) return null;
  const title = String(meta.name || '').trim();
  if (!title) return null;
  const year = cinemetaYear(meta.releaseInfo) || 0;
  const kind = String(meta.type || type).toLowerCase() === 'series' ? 'series' : 'movie';
  const future = year > new Date().getFullYear();
  // v59 — Cinemeta sends a full timestamp ("2026-12-18T00:00:00.000Z"), so the old strict
  // /^\d{4}-\d{2}-\d{2}$/ test rejected EVERY real date and cards silently lost their release day.
  const releasedRaw = String(meta.released || '').trim();
  const releasedDay = /^\d{4}-\d{2}-\d{2}/.test(releasedRaw) ? releasedRaw.slice(0, 10) : '';
  const releaseDate = /^(\d{4})-(\d{2})-(\d{2})$/.test(releasedDay) && Number(releasedDay.slice(0, 4)) >= 1870 && !releasedDay.includes('-00')
    ? releasedDay
    : '';
  const movie = cleanMovie({
    slug: id,
    imdbId: id,
    title,
    type: kind,
    year: year || new Date().getFullYear(),
    releaseDate,
    status: future || (releaseDate && new Date(releaseDate) > new Date()) ? 'upcoming' : 'released',
    region: 'International',
    country: String(Array.isArray(meta.country) ? meta.country[0] : meta.country || 'International').slice(0, 70),
    language: 'Original',
    genres: Array.isArray(meta.genres) ? meta.genres : [],
    rating: Number(meta.imdbRating) || 0,
    runtime: cinemetaRuntime(meta.runtime),
    ageRating: String(meta.certification || 'PG-13').slice(0, 12),
    tagline: String(meta.tagline || '').slice(0, 200),
    story: String(meta.description || '').slice(0, 1500),
    director: (Array.isArray(meta.director) ? meta.director.join(', ') : String(meta.director || '')).slice(0, 100),
    poster: cinemetaPoster(meta),
    backdrop: cinemetaBackdrop(meta),
    cast: cinemetaCast(meta),
    trailerYoutubeId: cinemetaTrailer(meta),
    seasons: kind === 'series' ? episodesFromCinemeta(meta) : [],
    legalProviders: [{ name: 'IMDb Official Page', kind: 'Official Info', url: `https://www.imdb.com/title/${id}/`, region: 'Global' }],
    keywords: [title, year || '', 'imdb', kind].filter(Boolean).join(' ').slice(0, 300),
  });
  if (!movie) return null;
  return { ...movie, source: 'cinemeta', cinemeta: true };
}

// ---------------------------------------------------------------------------------------------
// Network side
// ---------------------------------------------------------------------------------------------

/** Full meta for one IMDb id — movie first, then series (a shared link always resolves). */
export async function cinemetaMeta(rawId, { fetcher, timeout = TIMEOUT } = {}) {
  const id = String(rawId || '').trim().toLowerCase();
  if (!/^tt\d{6,10}$/.test(id)) return null;
  for (const type of ['movie', 'series']) {
    const data = await getJson(`${CINEMETA_BASE}/meta/${type}/${id}.json`, fetcher, timeout);
    const meta = data && data.meta;
    if (meta && (meta.name || meta.id)) return { meta: { ...meta, type: meta.type || type }, type: meta.type || type, imdbId: id };
  }
  return null;
}

/** A card-ready movie for one IMDb id (or null when Cinemeta does not know it). */
export async function cinemetaMovie(rawId, opts = {}) {
  const found = await cinemetaMeta(rawId, opts);
  if (!found) return null;
  return movieFromCinemeta(found.meta, found.type);
}

/**
 * One catalogue page. Cinemeta's path shape:
 *   /catalog/movie/top.json
 *   /catalog/movie/top/skip=100.json
 *   /catalog/movie/top/genre=Action&skip=200.json
 *   /catalog/movie/top/search=jawan.json
 */
export async function cinemetaCatalog({ type = 'movie', catalog = 'top', genre = '', search = '', skip = 0, fetcher, timeout = TIMEOUT } = {}) {
  const kind = type === 'series' ? 'series' : 'movie';
  const parts = [];
  if (genre) parts.push(`genre=${encodeURIComponent(genre)}`);
  if (search) parts.push(`search=${encodeURIComponent(search)}`);
  if (skip) parts.push(`skip=${Math.max(0, Number(skip) || 0)}`);
  const url = parts.length
    ? `${CINEMETA_BASE}/catalog/${kind}/${catalog || 'top'}/${parts.join('&')}.json`
    : `${CINEMETA_BASE}/catalog/${kind}/${catalog || 'top'}.json`;
  const data = await getJson(url, fetcher, timeout);
  const metas = (data && Array.isArray(data.metas) ? data.metas : []).filter((m) => m && /^tt\d{6,10}$/.test(String(m.id || m.imdb_id || '')));
  return metas.map((m) => movieFromCinemeta(m, kind)).filter(Boolean);
}

/** Search as you type, straight from the IMDb catalogue. */
export async function cinemetaSearch(query, { type = '', fetcher, timeout = TIMEOUT } = {}) {
  const q = String(query || '').trim().slice(0, 80);
  if (!q) return [];
  const types = type === 'series' ? ['series'] : type === 'movie' ? ['movie'] : ['movie', 'series'];
  const pages = await Promise.all(types.map((t) => cinemetaCatalog({ type: t, catalog: 'top', search: q, fetcher, timeout })));
  const seen = new Set();
  return pages.flat().filter((m) => {
    if (!m || seen.has(m.imdbId)) return false;
    seen.add(m.imdbId);
    return true;
  });
}

/** Clear the in-memory cache (tests / admin "refresh catalogue"). */
export function clearCinemetaCache() {
  cache.clear();
}
