// Mizanora v51 — "Continue watching" memory.
//
// The Cinema Player writes the position of every direct (HLS/MP4) stream every few seconds, and the
// Movies hub reads that list back as a shelf. Everything lives in the visitor's own browser
// (localStorage); no account, no server call, nothing leaves the device.
//
// Keys are versioned so a future shape change cannot break someone's saved list.

export const RECENT_KEY = 'mz_movie_recent_v1';
export const PROGRESS_PREFIX = 'mz_movie_pos_';
export const MAX_RECENT = 12;

const canUse = () => typeof window !== 'undefined' && Boolean(window.localStorage);

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const cleanEntry = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || raw.imdbId || raw.slug || '').trim().slice(0, 40);
  const title = String(raw.title || '').trim().slice(0, 140);
  if (!id || !title) return null;
  return {
    id,
    slug: String(raw.slug || id).trim().slice(0, 140),
    title,
    poster: String(raw.poster || '').slice(0, 400),
    year: Math.max(0, Math.min(2100, Number(raw.year) || 0)),
    type: raw.type === 'series' ? 'series' : 'movie',
    server: String(raw.server || '').slice(0, 60),
    t: Math.max(0, Number(raw.t) || 0),
    d: Math.max(0, Number(raw.d) || 0),
    at: Number(raw.at) || Date.now(),
  };
};

export function readRecent() {
  if (!canUse()) return [];
  const list = safeParse(window.localStorage.getItem(RECENT_KEY));
  if (!Array.isArray(list)) return [];
  return list.map(cleanEntry).filter(Boolean).slice(0, MAX_RECENT);
}

function writeRecent(list) {
  if (!canUse()) return [];
  const cleaned = (Array.isArray(list) ? list : []).map(cleanEntry).filter(Boolean).slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(cleaned));
  } catch {
    /* private mode / full quota */
  }
  return cleaned;
}

export function movieEntry(movie = {}) {
  if (!movie) return null;
  const id = String(movie.imdbId || movie.slug || '').trim().toLowerCase();
  if (!id) return null;
  return cleanEntry({
    id,
    slug: movie.slug || id,
    title: movie.title || id,
    poster: movie.poster || '',
    year: movie.year || 0,
    type: movie.type === 'series' ? 'series' : 'movie',
    at: Date.now(),
  });
}

// Add (or move to the front) one title. Position fields are preserved if we already knew them.
export function touchRecent(entry) {
  const item = cleanEntry(entry);
  if (!item) return readRecent();
  const list = readRecent();
  const old = list.find((x) => x.id === item.id);
  const merged = cleanEntry({
    ...old,
    ...item,
    t: item.t || (old ? old.t : 0),
    d: item.d || (old ? old.d : 0),
    at: Date.now(),
  });
  return writeRecent([merged, ...list.filter((x) => x.id !== item.id)]);
}

export function patchRecentProgress(id, t, d) {
  const key = String(id || '').trim().toLowerCase();
  if (!key) return readRecent();
  const list = readRecent();
  const at = list.findIndex((x) => x.id === key);
  if (at < 0) return list;
  const next = [...list];
  next[at] = cleanEntry({
    ...next[at],
    t: Math.max(0, Number(t) || 0),
    d: Math.max(0, Number(d) || 0),
    at: Date.now(),
  });
  return writeRecent(next);
}

export function removeRecent(id) {
  const key = String(id || '').trim().toLowerCase();
  return writeRecent(readRecent().filter((x) => x.id !== key));
}

export function clearRecent() {
  return writeRecent([]);
}

// "1:42:10" style label, used by the shelf and the resume chip.
export function clockLabel(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

export function progressPercent(entry) {
  const t = Number(entry && entry.t) || 0;
  const d = Number(entry && entry.d) || 0;
  if (!d || t <= 0) return 0;
  return Math.max(1, Math.min(100, Math.round((t / d) * 100)));
}
