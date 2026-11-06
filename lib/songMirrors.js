// Mizanora v56 — the music mirror layer.
//
// The Songs section never talks to a mirror from the browser without a plan B. Every song id is
// resolved through this module, which:
//
//   1. builds the mirror list (your own `SONGS_API_BASE` first, then the public JioSaavn bridges),
//   2. races them (fastest healthy answer wins) and remembers which ones are healthy,
//   3. exposes `/api/songs/audio/<id>` so the <audio> tag always plays through Mizanora's own URL —
//      a fresh CDN token on every request, no CORS, no hotlink/referer block,
//   4. can stream the bytes itself (`?proxy=1`) when a CDN refuses the redirect or the visitor is
//      behind a network that blocks the CDN host,
//   5. reports live mirror health on `/api/songs/health` so the admin page can show what is up.
//
// Nothing here invents data: if every mirror is down the caller gets `ok:false` and the UI shows an
// honest "mirror down" card with the retry and the YouTube search link.

import { cleanSong, songsFromPayload } from './songs';

const TTL = 20 * 60 * 1000;
const cache = new Map();
const health = new Map(); // base -> { ok, at, ms }

const fresh = (hit) => hit && Date.now() - hit.at < TTL;

/** All configured mirrors, in priority order, de-duplicated. */
export function mirrorBases() {
  const many = String(process.env.SONGS_API_BASES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const list = [
    String(process.env.SONGS_API_BASE || '').trim(),
    ...many,
    'https://saavn.dev/api',
    'https://jiosavan-api2.vercel.app/api',
  ]
    .map((s) => s.replace(/\/+$/, ''))
    .filter(Boolean);
  return [...new Set(list)];
}

const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function mirrorJson(base, path, timeout = 7000) {
  const url = `${base}${path}`;
  const hit = cache.get(url);
  if (fresh(hit)) return hit.value;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeout) : null;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      ...(ctrl ? { signal: ctrl.signal } : {}),
      headers: { accept: 'application/json', 'user-agent': ua },
      cache: 'no-store',
    });
    if (!res || !res.ok) {
      health.set(base, { ok: false, at: Date.now(), ms: Date.now() - started });
      return null;
    }
    const value = await res.json();
    if (value) {
      cache.set(url, { value, at: Date.now() });
      health.set(base, { ok: true, at: Date.now(), ms: Date.now() - started });
      if (cache.size > 500) {
        [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 100).forEach(([k]) => cache.delete(k));
      }
    }
    return value;
  } catch {
    health.set(base, { ok: false, at: Date.now(), ms: Date.now() - started });
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Race every mirror; the first usable payload wins. Returns { data, via }. */
export async function raceMirrors(path, timeout = 7000) {
  const bases = mirrorBases();
  const attempts = bases.map(async (base) => {
    const data = await mirrorJson(base, path, timeout);
    if (!data) throw new Error('no data');
    return { data, via: base };
  });
  try {
    return await Promise.any(attempts);
  } catch {
    return { data: null, via: '' };
  }
}

/** One song (cleanSong shape) resolved from any mirror. Returns { song, via }. */
export async function resolveSongById(rawId) {
  const id = String(rawId || '').trim();
  if (!/^[A-Za-z0-9_-]{4,}$/.test(id)) return { song: null, via: '' };
  const { data, via } = await raceMirrors(`/songs/${encodeURIComponent(id)}`);
  if (!data) return { song: null, via: '' };
  const list = songsFromPayload(data);
  const song = list[0] || cleanSong(data.data ? data.data : data);
  return { song: song || null, via };
}

/** The URL the browser should put in <audio src>. Always our own origin. */
export const audioUrl = (id) => `/api/songs/audio/${encodeURIComponent(String(id || ''))}`;

/** Live health of every mirror — used by /admin/songs and /api/songs/health. */
export async function mirrorHealth(timeout = 5000) {
  const bases = mirrorBases();
  const rows = await Promise.all(bases.map(async (base) => {
    const started = Date.now();
    const data = await mirrorJson(base, '/search/songs?query=atif%20aslam&limit=1', timeout);
    const songs = data ? songsFromPayload(data) : [];
    return {
      base,
      ok: Boolean(songs.length),
      ms: Date.now() - started,
      reason: songs.length ? 'ok' : (data ? 'empty answer' : 'unreachable'),
    };
  }));
  return {
    ok: rows.some((r) => r.ok),
    mirrors: rows,
    checkedAt: new Date().toISOString(),
  };
}

/** A tiny memory of what has failed recently, so the UI can say "2 mirrors down" honestly. */
export function mirrorSnapshot() {
  return [...health.entries()].map(([base, v]) => ({ base, ...v }));
}
