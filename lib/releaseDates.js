// Mizanora v59 — REAL release dates for the calendar.
//
// The offline IMDb snapshot only stores a year ("2026"), so the release calendar used to group every
// title under "2026 — date TBA". That is honest but useless: people want to see *when* a film is
// coming. Cinemeta's meta endpoint carries the exact date (`released: "2026-12-18T00:00:00.000Z"`),
// which is where the rest of the catalogue already comes from.
//
// This module asks Cinemeta for the missing dates, a few at a time, with a time budget, and remembers
// the answers (in memory + Next's fetch cache for a day). If Cinemeta is unreachable the calendar
// keeps its old, honest behaviour — nothing is ever invented.

const BASE = 'https://v3-cinemeta.strem.io/meta';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const memo = new Map(); // imdbId -> { date, at }
const TTL = 12 * 3600 * 1000;

const isIsoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

// Cinemeta sometimes ships a placeholder such as "0000-00-00" or a month/day of 00. A calendar
// group keyed on "-00" is exactly the "date TBA" bucket, so such values must count as NO date.
const plausible = (v) => {
  if (!isIsoDate(v)) return false;
  const [y, m, d] = String(v).split('-').map(Number);
  return y >= 1870 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
};

export function dateFromMeta(meta) {
  if (!meta || typeof meta !== 'object') return '';
  const released = String(meta.released || '').trim();
  if (plausible(released)) return released;
  const m = released.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m && plausible(`${m[1]}-${m[2]}-${m[3]}`)) return `${m[1]}-${m[2]}-${m[3]}`;
  const info = String(meta.releaseInfo || '').trim();
  if (plausible(info)) return info;
  return '';
}

async function fetchOne(id, timeout = 5000) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeout) : null;
  try {
    for (const kind of ['movie', 'series']) {
      const res = await fetch(`${BASE}/${kind}/${id}.json`, {
        ...(ctrl ? { signal: ctrl.signal } : {}),
        headers: { accept: 'application/json', 'user-agent': UA },
        next: { revalidate: 86400 },
      });
      if (!res || !res.ok) continue;
      const json = await res.json();
      const date = dateFromMeta(json && json.meta);
      if (date) return date;
    }
    return '';
  } catch {
    return '';
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** The exact release date (YYYY-MM-DD) for one IMDb id, or '' when Cinemeta has none. */
export async function releaseDateFor(imdbId, timeout = 5000) {
  const id = String(imdbId || '').trim().toLowerCase();
  if (!/^tt\d{6,10}$/.test(id)) return '';
  const hit = memo.get(id);
  if (hit && Date.now() - hit.at < TTL) return hit.date;
  const date = await fetchOne(id, timeout);
  memo.set(id, { date, at: Date.now() });
  if (memo.size > 6000) {
    [...memo.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 1500).forEach(([k]) => memo.delete(k));
  }
  return date;
}

/**
 * Fill in missing release dates for a list of movie cards (in place) and fix their status.
 * Only titles that look like they belong on a release calendar are asked about, so a page never
 * spends its whole render budget on 1980s films.
 */
export async function enrichReleaseDates(movies = [], { limit = 180, budgetMs = 8000, concurrency = 12 } = {}) {
  const list = Array.isArray(movies) ? movies : [];
  const today = new Date().toISOString().slice(0, 10);
  const nowYear = new Date().getFullYear();

  const todo = list
    .filter((m) => m && m.imdbId && !isIsoDate(m.releaseDate))
    .filter((m) => Number(m.year) >= nowYear - 1 || m.status === 'upcoming')
    .sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0))
    .slice(0, Math.max(0, limit));

  const started = Date.now();
  let cursor = 0;

  const worker = async () => {
    while (cursor < todo.length) {
      if (Date.now() - started > budgetMs) return;
      const m = todo[cursor];
      cursor += 1;
      const date = await releaseDateFor(m.imdbId, 5000);
      if (!date) continue;
      m.releaseDate = date;
      m.status = date > today ? 'upcoming' : 'released';
      if (!m.year || Number(m.year) < 1900) m.year = Number(date.slice(0, 4));
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, todo.length)) }, worker));
  return list;
}

/** How many of these titles are still in the future (used for the hub's calendar badge). */
export function countUpcoming(movies = []) {
  const today = new Date().toISOString().slice(0, 10);
  return (Array.isArray(movies) ? movies : []).filter((m) => m && isIsoDate(m.releaseDate) && m.releaseDate > today).length;
}

/**
 * v59 — "0 upcoming releases" is a sad thing to print on a release calendar.
 *
 * The committed snapshot only reaches the current year, but the id pool (data/imdb-ids.txt) also
 * carries next year's announcements. Those ids have no title or date of their own, so this asks
 * Cinemeta for the card (title, poster, story, exact date) of the few that are genuinely in the
 * future and returns them as normal movie cards. Budgeted, concurrent, and silent on failure.
 */
export async function upcomingFromPool({ fromYear = new Date().getFullYear() + 1, limit = 40, budgetMs = 6000, concurrency = 10 } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  let ids = [];
  try {
    const { getSitemapIds } = await import('./moviesWorld');
    ids = await getSitemapIds();
  } catch {
    return [];
  }
  const candidates = (Array.isArray(ids) ? ids : [])
    .filter((x) => x && x.id && Number(x.year) >= fromYear)
    .sort((a, b) => Number(b.year) - Number(a.year))
    .slice(0, Math.max(0, limit));
  if (!candidates.length) return [];

  let cinemetaMovie;
  try {
    ({ cinemetaMovie } = await import('./cinemeta'));
  } catch {
    return [];
  }

  const started = Date.now();
  let cursor = 0;
  const out = [];
  const seen = new Set();
  const worker = async () => {
    while (cursor < candidates.length) {
      if (Date.now() - started > budgetMs) return;
      const entry = candidates[cursor];
      cursor += 1;
      let card = null;
      try { card = await cinemetaMovie(entry.id); } catch { card = null; }
      if (!card || !card.slug || seen.has(card.slug)) continue;
      const date = isIsoDate(card.releaseDate) ? card.releaseDate : '';
      const future = (date && date > today) || Number(card.year) > new Date().getFullYear();
      if (!future) continue;
      seen.add(card.slug);
      out.push({ ...card, releaseDate: date, status: 'upcoming' });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, candidates.length)) }, worker));
  return out;
}
