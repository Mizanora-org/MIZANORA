// Mizanora v54 — server side of the Songs section.
//
// The public JioSaavn-style APIs are meant to be called server-to-server (they send no CORS
// header), which is exactly why the MINEXUS Music tab was empty until it moved behind its own
// /api/music proxy. MIZANORA does the same: the browser only ever talks to our own routes, and
// this file talks to the mirrors, racing them so the fastest healthy mirror wins.

import { SONG_QUERIES, artistSlug, cleanSong, songsFromPayload } from './songs';

const MIRRORS = [
  String(process.env.SONGS_API_BASE || '').replace(/\/+$/, ''),
  'https://saavn.dev/api',
  'https://jiosavan-api2.vercel.app/api',
].filter(Boolean);

const TTL = 30 * 60 * 1000;
const cache = new Map();
const fresh = (hit) => hit && Date.now() - hit.at < TTL;

const getJson = async (url, timeout = 7000) => {
  const hit = cache.get(url);
  if (fresh(hit)) return hit.value;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeout) : null;
  try {
    const res = await fetch(url, {
      ...(ctrl ? { signal: ctrl.signal } : {}),
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    if (!res || !res.ok) return null;
    const value = await res.json();
    if (value) {
      cache.set(url, { value, at: Date.now() });
      if (cache.size > 400) {
        [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 80).forEach(([k]) => cache.delete(k));
      }
    }
    return value;
  } catch (_) {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/** Try every mirror at once; the first usable answer wins (Promise.any), errors are swallowed. */
async function race(pathname, timeout = 7000) {
  const attempts = MIRRORS.map(async (base) => {
    const data = await getJson(`${base}${pathname}`, timeout);
    if (!data) throw new Error('no data');
    return data;
  });
  try {
    return await Promise.any(attempts);
  } catch {
    return null;
  }
}

/** Search songs by name / artist. */
export async function searchSongs(query, limit = 24) {
  const q = String(query || '').trim().slice(0, 80);
  if (!q) return { items: [], source: '' };
  const data = await race(`/search/songs?query=${encodeURIComponent(q)}&limit=${Math.max(1, Math.min(40, Number(limit) || 24))}`);
  const items = songsFromPayload(data).slice(0, limit);
  // v55: the browser uses this flag to decide whether to retry the mirrors itself.
  return { items, source: items.length ? 'jiosaavn' : '', upstream: data ? 'ok' : 'down' };
}

/** Full details for one song id. */
export async function getSongById(rawId) {
  const id = String(rawId || '').trim();
  if (!/^[A-Za-z0-9_-]{4,}$/.test(id)) return null;
  const data = await race(`/songs/${encodeURIComponent(id)}`);
  const list = songsFromPayload(data);
  if (list.length) return list[0];
  const single = cleanSong(data && data.data ? data.data : data);
  return single;
}

// Trending = a handful of curated queries, merged, shuffled once and cached for 30 minutes.
const trendingCache = { at: 0, songs: [] };

export async function getTrendingSongs(limit = 24) {
  if (Date.now() - trendingCache.at < TTL && trendingCache.songs.length >= Math.min(12, limit)) {
    return trendingCache.songs.slice(0, limit);
  }
  const picks = SONG_QUERIES.slice(0, 6);
  const results = await Promise.all(picks.map((q) => searchSongs(q, 12).catch(() => ({ items: [] }))));
  const seen = new Set();
  const songs = [];
  // Interleave the queries so the first row is not all one artist.
  const lists = results.map((r) => r.items);
  const maxLen = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < maxLen; i += 1) {
    for (const list of lists) {
      const s = list[i];
      if (!s || seen.has(s.id)) continue;
      seen.add(s.id);
      songs.push(s);
      if (songs.length >= Math.max(limit, 36)) break;
    }
    if (songs.length >= Math.max(limit, 36)) break;
  }
  if (songs.length) trendingCache.at = Date.now();
  trendingCache.songs = songs;
  return songs.slice(0, limit);
}


/** Every song we know for an artist name (search is the source; cached with the search cache). */
export async function getArtistSongs(name, limit = 30) {
  const q = String(name || '').trim();
  if (!q) return { items: [], source: '' };
  const { items } = await searchSongs(q, Math.max(limit, 20));
  // Keep the songs that actually credit this artist, best matches first.
  const wanted = artistSlug(q);
  const owns = (s) => (s.artists || []).some((a) => artistSlug(a) === wanted || artistSlug(a).includes(wanted) || wanted.includes(artistSlug(a)));
  const own = items.filter(owns);
  return { items: (own.length ? own : items).slice(0, limit), source: items.length ? 'jiosaavn' : '' };
}

/** The singers/artists behind the current trending list, deduped, with a cover image. */
export async function getTrendingArtists(limit = 12) {
  const songs = await getTrendingSongs(36).catch(() => []);
  const seen = new Set();
  const out = [];
  for (const s of songs) {
    for (const name of s.artists || []) {
      const slug = artistSlug(name);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      out.push({ name, slug, image: s.image || '', sample: s.title });
      if (out.length >= limit) break;
    }
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * v59 — the song pages we can honestly advertise.
 *
 * Before this the sitemap listed 60 trending tracks; that is a rounding error next to the catalogue
 * the site actually serves. Now we search the same mirrors across every seed query and every singer
 * profile, dedupe by song id, and return a few hundred real, playable pages plus every artist page
 * the results mention. Answers are cached by the mirror layer, so a 6-hourly sitemap refresh is cheap.
 */
async function buildSongsForSitemap(limit = 900) {
  const { ARTIST_PROFILES } = await import('./artistProfiles');
  const queries = [
    ...SONG_QUERIES,
    ...ARTIST_PROFILES.map((a) => a.name),
  ].filter(Boolean).slice(0, 26);

  const settled = await Promise.allSettled(queries.map((q) => searchSongs(q, 40)));
  const seenSongs = new Set();
  const seenArtists = new Map();
  const songs = [];

  for (const r of settled) {
    if (!r || r.status !== 'fulfilled' || !r.value || !Array.isArray(r.value.items)) continue;
    for (const song of r.value.items) {
      if (!song || !song.slug) continue;
      for (const name of song.artists || []) {
        const slug = artistSlug(name);
        if (slug && !seenArtists.has(slug)) seenArtists.set(slug, { slug, name, image: song.image || '' });
      }
      if (seenSongs.has(song.id)) continue;
      seenSongs.add(song.id);
      songs.push({ slug: song.slug, title: song.title, artists: song.artists || [] });
      if (songs.length >= limit) break;
    }
    if (songs.length >= limit) break;
  }

  // The hand-written profiles are stable pages worth listing even when a mirror hiccups.
  for (const a of ARTIST_PROFILES) {
    if (!seenArtists.has(a.slug)) seenArtists.set(a.slug, { slug: a.slug, name: a.name, image: '' });
  }

  return {
    songs,
    artists: [...seenArtists.values()].slice(0, 4000),
    generatedAt: Date.now(),
  };
}

// v59 — the sitemap asks for this catalogue from ~28 files (songs.xml + one file per letter).
// Building it costs 20+ mirror searches, so it is memoised for six hours and de-duplicated while
// in flight: the first caller pays, everyone else waits on the same promise.
const sitemapCache = { at: 0, limit: 0, data: null, promise: null };
const SITEMAP_TTL = 6 * 3600 * 1000;

export async function getSongsForSitemap(limit = 900) {
  const want = Math.max(1, Math.min(2000, Number(limit) || 900));
  if (sitemapCache.data && sitemapCache.limit >= want && Date.now() - sitemapCache.at < SITEMAP_TTL) {
    return sitemapCache.data;
  }
  if (sitemapCache.promise) {
    const data = await sitemapCache.promise.catch(() => null);
    if (data) return data;
  }
  const promise = buildSongsForSitemap(want).catch(() => ({ songs: [], artists: [], generatedAt: Date.now() }));
  sitemapCache.promise = promise;
  const data = await promise;
  sitemapCache.promise = null;
  sitemapCache.at = Date.now();
  sitemapCache.limit = want;
  sitemapCache.data = data;
  return data;
}

export function songsMirrors() {
  return MIRRORS;
}
