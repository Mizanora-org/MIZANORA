// Mizanora v51 — "My List" (movie watchlist) kept in the visitor's own browser.
// Same rules as lib/movieProgress.js: no account, no cookies, no server calls.

export const MOVIE_LIST_KEY = 'mz_movie_list_v1';
export const MAX_LIST = 60;

const canUse = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const cleanEntry = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || raw.imdbId || raw.slug || '').trim().toLowerCase().slice(0, 40);
  const title = String(raw.title || '').trim().slice(0, 140);
  if (!id || !title) return null;
  return {
    id,
    slug: String(raw.slug || id).trim().slice(0, 140),
    title,
    poster: String(raw.poster || '').slice(0, 400),
    year: Math.max(0, Math.min(2100, Number(raw.year) || 0)),
    type: raw.type === 'series' ? 'series' : 'movie',
    at: Number(raw.at) || Date.now(),
  };
};

export function readList() {
  if (!canUse()) return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(MOVIE_LIST_KEY));
    if (!Array.isArray(raw)) return [];
    return raw.map(cleanEntry).filter(Boolean).slice(0, MAX_LIST);
  } catch {
    return [];
  }
}

function writeList(list) {
  if (!canUse()) return [];
  const cleaned = (Array.isArray(list) ? list : []).map(cleanEntry).filter(Boolean).slice(0, MAX_LIST);
  try {
    window.localStorage.setItem(MOVIE_LIST_KEY, JSON.stringify(cleaned));
  } catch {
    /* private mode / quota */
  }
  return cleaned;
}

export function inList(id) {
  const key = String(id || '').trim().toLowerCase();
  return readList().some((x) => x.id === key);
}

export function addToList(entry) {
  const item = cleanEntry(entry);
  if (!item) return readList();
  const list = readList();
  if (list.some((x) => x.id === item.id)) return list;
  return writeList([{ ...item, at: Date.now() }, ...list]);
}

export function removeListItem(id) {
  const key = String(id || '').trim().toLowerCase();
  return writeList(readList().filter((x) => x.id !== key));
}

export function toggleListItem(entry) {
  const item = cleanEntry(entry);
  if (!item) return { added: false, list: readList() };
  if (inList(item.id)) {
    return { added: false, list: removeListItem(item.id) };
  }
  return { added: true, list: addToList(item) };
}

export function clearList() {
  return writeList([]);
}
