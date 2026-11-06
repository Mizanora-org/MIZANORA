// Mizanora v55 — browser-side song lookup with a second chance.
//
// The normal path is our own /api/songs/search (which races the mirrors server-side). If that
// comes back with `upstream: 'down'` — a preview sandbox with no outbound internet, a serverless
// hiccup, a mirror outage — the browser tries the mirrors itself. Some mirrors do send CORS
// headers, and a direct call from the visitor's own network sometimes works when the server's
// does not. Whichever answers first is used; nothing is cached except in memory.

import { cleanSong, songsFromPayload } from './songs';

export const CLIENT_MIRRORS = ['https://saavn.dev/api', 'https://jiosavan-api2.vercel.app/api'];

const TIMEOUT = 8000;

const timedFetch = async (url) => {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT) : null;
  try {
    const res = await fetch(url, {
      ...(ctrl ? { signal: ctrl.signal } : {}),
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/** Search through the mirrors directly (browser). Returns { items, source }. */
export async function searchSongsDirect(query, limit = 24) {
  const q = String(query || '').trim().slice(0, 80);
  if (!q) return { items: [], source: '' };
  const attempts = CLIENT_MIRRORS.map(async (base) => {
    const data = await timedFetch(`${base}/search/songs?query=${encodeURIComponent(q)}&limit=${Math.max(1, Math.min(40, limit))}`);
    if (!data) throw new Error('no data');
    return data;
  });
  const seen = new Set();
  const items = [];
  // Promise.any keeps it fast; but if the first answer is thin, the second is asked too.
  let settled = 0;
  await new Promise((resolve) => {
    attempts.forEach((p) => {
      p.then((data) => {
        for (const s of songsFromPayload(data)) {
          if (seen.has(s.id)) continue;
          seen.add(s.id);
          items.push(s);
        }
      }).catch(() => {}).finally(() => {
        settled += 1;
        if (items.length >= Math.min(limit, 6) || settled === attempts.length) resolve();
      });
    });
  });
  return { items: items.slice(0, limit), source: items.length ? 'direct' : '' };
}

/** One song by id, straight from a mirror (browser). */
export async function songByIdDirect(id) {
  const raw = String(id || '').trim();
  if (!/^[A-Za-z0-9_-]{4,}$/.test(raw)) return null;
  const attempts = CLIENT_MIRRORS.map(async (base) => {
    const data = await timedFetch(`${base}/songs/${encodeURIComponent(raw)}`);
    if (!data) throw new Error('no data');
    return data;
  });
  try {
    const data = await Promise.any(attempts);
    const list = songsFromPayload(data);
    return list[0] || cleanSong(data && data.data ? data.data : data);
  } catch {
    return null;
  }
}
