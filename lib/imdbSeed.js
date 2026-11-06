// Mizanora v55 — the offline IMDb snapshot.
//
// v54 read everything from Cinemeta at request time. That is still the first choice, but a preview
// sandbox, a build machine, or a minute of upstream trouble left /movies, /search, the calendar and
// the sitemap empty. data/imdb-seed.json (built by scripts/build-imdb-seed.mjs from IMDb's public
// dataset) fixes that: 16,000+ films and ~900 series that always exist, with Cinemeta taking over
// whenever it answers.
//
// This module is SERVER-ONLY (it reads from disk). Everything it returns is already a normal
// MIZANORA movie card, so pages, search and the sitemap need no special cases.

import fs from 'node:fs';
import path from 'node:path';
import { cleanMovie, slugifyMovie } from './movies';
import { METAHUB_BASE } from './cinemeta';

let store = null; // { movies: raw[], series: raw[], byId: Map }

const FILE = () => path.join(process.cwd(), 'data', 'imdb-seed.json');

const REGION_BY_COUNTRY = [
  ['Pakistan', 'Pakistan'],
  ['India', 'India'],
  ['Iran', 'Iran & Afghanistan'],
  ['Afghanistan', 'Iran & Afghanistan'],
  ['Bangladesh', 'Bangladesh'],
  ['Turkey', 'Turkey & Arabic'],
  ['Iraq', 'Turkey & Arabic'],
  ['Syria', 'Turkey & Arabic'],
  ['Egypt', 'Turkey & Arabic'],
  ['Saudi Arabia', 'Turkey & Arabic'],
  ['United Arab Emirates', 'Turkey & Arabic'],
];

const regionOf = (country) => {
  const c = String(country || '');
  for (const [name, region] of REGION_BY_COUNTRY) if (c.includes(name)) return region;
  return 'International';
};

const poster = (id) => `${METAHUB_BASE}/poster/medium/${id}/img`;
const backdrop = (id) => `${METAHUB_BASE}/background/medium/${id}/img`;

function load() {
  if (store) return store;
  let data = { movies: [], series: [] };
  try {
    data = JSON.parse(fs.readFileSync(FILE(), 'utf8'));
  } catch { /* no snapshot — the site still works from Cinemeta */ }
  const movies = (Array.isArray(data.movies) ? data.movies : []).map((m) => (m ? { ...m, kind: 'movie' } : m));
  const series = (Array.isArray(data.series) ? data.series : []).map((s) => (s ? { ...s, kind: 'series' } : s));
  const byId = new Map();
  for (const m of movies) if (m && m.i) byId.set(m.i, m);
  for (const s of series) if (s && s.i && !byId.has(s.i)) byId.set(s.i, s);
  store = { movies, series, byId, generated: data.generated || '' };
  return store;
}

/** One raw snapshot entry -> a normal movie card. */
export function cardFromSeed(raw, kind = 'movie') {
  if (!raw || !raw.i) return null;
  const type = (raw.kind || kind) === 'series' ? 'series' : 'movie';
  const year = Number(raw.y) || 0;
  const now = new Date().getFullYear();
  const movie = cleanMovie({
    slug: raw.i,
    imdbId: raw.i,
    title: raw.t,
    type,
    year: year || now,
    releaseDate: '',
    status: year > now ? 'upcoming' : 'released',
    region: regionOf(raw.c),
    country: raw.c || 'International',
    language: raw.l || 'Original',
    genres: raw.g || [],
    rating: Number(raw.r) || 0,
    runtime: Number(raw.d) || 0,
    ageRating: 'PG-13',
    tagline: '',
    story: raw.s || `${raw.t}${year ? ` (${year})` : ''} — IMDb metadata snapshot. Full synopsis, cast and episodes load from IMDb when online.`,
    director: raw.dir || '',
    poster: poster(raw.i),
    backdrop: backdrop(raw.i),
    cast: (raw.ca || []).map((name) => ({ name, slug: slugifyMovie(name) })),
    trailerYoutubeId: '',
    seasons: [],
    legalProviders: [{ name: 'IMDb Official Page', kind: 'Official Info', url: `https://www.imdb.com/title/${raw.i}/`, region: 'Global' }],
    keywords: [raw.t, year || '', ...(raw.g || []), 'imdb'].filter(Boolean).join(' ').slice(0, 300),
  });
  if (!movie) return null;
  return { ...movie, source: 'imdb-snapshot', snapshot: true };
}

/** One card by IMDb id (works for films and series). */
export function seedMovie(rawId) {
  const id = String(rawId || '').trim().toLowerCase();
  if (!/^tt\d{6,10}$/.test(id)) return null;
  const raw = load().byId.get(id);
  return raw ? cardFromSeed(raw) : null;
}

export function seedSize() {
  const s = load();
  return { movies: s.movies.length, series: s.series.length, generated: s.generated };
}

/** Substring search across title, cast, director, genre and year — the offline half of search. */
export function searchSeed(query, { type = 'all', limit = 24 } = {}) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const s = load();
  const pool = type === 'movie' ? s.movies : type === 'series' ? s.series : [...s.movies, ...s.series];
  const idHit = /^tt\d{6,10}$/.test(q) ? q : '';
  const words = q.split(/\s+/).filter(Boolean).slice(0, 5);
  const scored = [];
  for (const m of pool) {
    const title = String(m.t || '').toLowerCase();
    const alias = String(m.a || '').toLowerCase();
    let score = 0;
    if (idHit) {
      if (m.i !== idHit) continue;
      score = 100;
    } else {
      if (title === q || alias === q) score = 60;
      else if (title.startsWith(q) || alias.startsWith(q)) score = 45;
      else if (title.includes(q) || alias.includes(q)) score = 30;
      const cast = (m.ca || []).join(' ').toLowerCase();
      const dir = String(m.dir || '').toLowerCase();
      const gen = (m.g || []).join(' ').toLowerCase();
      if (!score) {
        if (cast.includes(q)) score = 18;
        else if (dir.includes(q)) score = 16;
        else if (gen.includes(q)) score = 10;
        else if (String(m.y) === q) score = 8;
      }
      if (!score && words.length > 1 && words.every((w) => `${title} ${alias} ${cast} ${dir} ${gen}`.includes(w))) score = 12;
      if (!score) continue;
    }
    scored.push({ m, score: score + (Number(m.y) || 0) / 10000 + (Number(m.r) || 0) / 1000 });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, Math.min(60, limit))).map((x) => cardFromSeed(x.m)).filter(Boolean);
}

/** The shelves: top rated, newest films, and a series row. */
export function seedRows(limit = 18) {
  const s = load();
  const byRating = [...s.movies].filter((m) => (Number(m.r) || 0) > 0).sort((a, b) => (b.r - a.r) || (b.y - a.y)).slice(0, limit);
  const newest = [...s.movies].sort((a, b) => b.y - a.y || b.r - a.r).slice(0, limit);
  const series = [...s.series].sort((a, b) => b.y - a.y || b.r - a.r).slice(0, limit);
  const rows = [];
  if (byRating.length) rows.push({ key: 'imdb-top-rated', title: 'IMDb Top Rated', blurb: 'IMDb ki ratings ke hisaab se sab se ooncha.', movies: byRating.map((m) => cardFromSeed(m)).filter(Boolean) });
  if (newest.length) rows.push({ key: 'imdb-newest', title: 'Newest Additions', blurb: 'Snapshot ka sab se naya saal pehle.', movies: newest.map((m) => cardFromSeed(m)).filter(Boolean) });
  if (series.length) rows.push({ key: 'imdb-series', title: 'Series & Dramas', blurb: 'IMDb series, season aur episode guide ke saath.', movies: series.map((m) => cardFromSeed(m)).filter(Boolean) });
  return rows;
}

/** A compact "featured" slice for the hub: top rated + newest + series, deduped. */
export function seedFeatured(limit = 140) {
  const s = load();
  const picked = [];
  const seen = new Set();
  const push = (raw) => {
    if (!raw || !raw.i || seen.has(raw.i) || picked.length >= limit) return;
    seen.add(raw.i);
    picked.push(raw);
  };
  [...s.movies].sort((a, b) => (Number(b.r) || 0) - (Number(a.r) || 0)).slice(0, Math.ceil(limit / 3)).forEach(push);
  [...s.movies].sort((a, b) => (Number(b.y) || 0) - (Number(a.y) || 0)).slice(0, Math.ceil(limit / 3)).forEach(push);
  [...s.series].sort((a, b) => (Number(b.y) || 0) - (Number(a.y) || 0) || (Number(b.r) || 0) - (Number(a.r) || 0)).slice(0, Math.ceil(limit / 3)).forEach(push);
  return picked.map((m) => cardFromSeed(m)).filter(Boolean);
}

/** The newest N titles (films + series), used by the release calendar. */
export function seedNewest(limit = 300) {
  const s = load();
  return [...s.movies, ...s.series]
    .sort((a, b) => (Number(b.y) || 0) - (Number(a.y) || 0) || (Number(b.r) || 0) - (Number(a.r) || 0))
    .slice(0, Math.max(1, Math.min(3000, limit)))
    .map((m) => cardFromSeed(m))
    .filter(Boolean);
}

/** Titles whose year is this year or later (also used by the release calendar). */
export function seedUpcoming(limit = 60, refYear = new Date().getFullYear()) {
  const s = load();
  return [...s.movies, ...s.series]
    .filter((m) => (Number(m.y) || 0) >= refYear)
    .sort((a, b) => b.y - a.y || b.r - a.r)
    .slice(0, limit)
    .map((m) => cardFromSeed(m))
    .filter(Boolean);
}

/** Newest titles grouped by year, for the calendar's "latest releases" view. */
export function seedByYear(limitPerYear = 24, years = 4) {
  const s = load();
  const all = [...s.movies, ...s.series].sort((a, b) => b.y - a.y || b.r - a.r);
  const groups = new Map();
  for (const m of all) {
    const y = Number(m.y) || 0;
    if (!y) continue;
    const list = groups.get(y) || [];
    if (list.length >= limitPerYear) continue;
    list.push(m);
    groups.set(y, list);
    if (groups.size >= years && y < Math.min(...groups.keys())) break;
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([year, list]) => ({ year, movies: list.map((m) => cardFromSeed(m)).filter(Boolean) }));
}

/** Raw id list for the sitemap fallback (cheap, no card building). */
export function seedIds(limit = 50000) {
  const s = load();
  const out = [];
  const seen = new Set();
  for (const m of [...s.movies, ...s.series]) {
    if (!m.i || seen.has(m.i)) continue;
    seen.add(m.i);
    out.push({ id: m.i, type: m.kind === 'series' ? 'series' : 'movie', year: Number(m.y) || 0 });
    if (out.length >= limit) break;
  }
  return out;
}

export function clearSeedCache() {
  store = null;
}

// ---------------------------------------------------------------------------------------------
// v57 — the cast directory.
//
// data/imdb-seed.json stores the real cast list of every title (`ca`). That is 55,000+ distinct
// names, and ~10,400 of them appear in three or more titles — plenty to build a proper actors
// directory and a full filmography page for every one of them, exactly like the reference site,
// without inventing a single biography. Everything here is derived, never made up.
// ---------------------------------------------------------------------------------------------

let castIndex = null; // Map<slug, { name, slug, count, years:[], titles:[{i,t,y,r}] }>

function buildCastIndex() {
  if (castIndex) return castIndex;
  const s = load();
  const map = new Map();
  for (const raw of [...s.movies, ...s.series]) {
    if (!raw || !raw.i) continue;
    const year = Number(raw.y) || 0;
    const rating = Number(raw.r) || 0;
    for (const name of raw.ca || []) {
      const person = String(name || '').trim();
      if (!person || person.length > 60) continue;
      const slug = slugifyMovie(person);
      if (!slug) continue;
      let row = map.get(slug);
      if (!row) {
        row = { name: person, slug, count: 0, years: [], titles: [] };
        map.set(slug, row);
      }
      row.count += 1;
      if (year) row.years.push(year);
      row.titles.push({ i: raw.i, t: raw.t, y: year, r: rating });
    }
  }
  for (const row of map.values()) {
    row.titles.sort((a, b) => (b.r || 0) - (a.r || 0) || (b.y || 0) - (a.y || 0));
    row.years.sort((a, b) => a - b);
    row.from = row.years.length ? row.years[0] : 0;
    row.to = row.years.length ? row.years[row.years.length - 1] : 0;
    row.knownFor = row.titles.slice(0, 3).map((t) => t.t).filter(Boolean);
  }
  castIndex = map;
  return castIndex;
}

/** One cast member by name or slug, with the real snapshot counts. */
export function seedActor(slugOrName) {
  const raw = String(slugOrName || '').trim();
  if (!raw) return null;
  const index = buildCastIndex();
  const slug = slugifyMovie(raw);
  const row = index.get(slug) || index.get(raw.toLowerCase());
  return row ? { ...row } : null;
}

/** The filmography of one cast member as normal movie cards (best rated first). */
export function seedFilmography(slugOrName, limit = 60) {
  const row = seedActor(slugOrName);
  if (!row) return [];
  const out = [];
  const seen = new Set();
  for (const t of row.titles) {
    if (out.length >= limit) break;
    if (seen.has(t.i)) continue;
    seen.add(t.i);
    const card = seedMovie(t.i);
    if (card) out.push(card);
  }
  return out;
}

/**
 * The cast directory, letter/search filtered and paginated.
 * Default `minTitles: 3` keeps the list to working actors instead of every one-line extra.
 */
export function seedActorRows({ q = '', letter = '', offset = 0, limit = 60, minTitles = 3 } = {}) {
  const index = buildCastIndex();
  const needle = String(q || '').trim().toLowerCase();
  const first = String(letter || '').trim().toUpperCase();
  const rows = [];
  for (const row of index.values()) {
    if (row.count < minTitles) continue;
    if (first && !row.name.toUpperCase().startsWith(first)) continue;
    if (needle && !row.name.toLowerCase().includes(needle)) continue;
    rows.push(row);
  }
  rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const start = Math.max(0, Number(offset) || 0);
  return {
    total: rows.length,
    rows: rows.slice(start, start + Math.max(1, Math.min(200, Number(limit) || 60))),
  };
}

/** How many cast members the snapshot has with at least N titles. */
export function seedCastSize(minTitles = 3) {
  const index = buildCastIndex();
  let n = 0;
  for (const row of index.values()) if (row.count >= minTitles) n += 1;
  return n;
}

/**
 * v59 — every first letter that actually has cast members in the snapshot.
 * The sitemap index and the /sitemaps guide both need this list; computing it once
 * (instead of 26 filtered passes) keeps those pages fast.
 */
export function seedActorLetters(minTitles = 3) {
  const index = buildCastIndex();
  const set = new Set();
  for (const row of index.values()) {
    if (row.count < minTitles) continue;
    const c = String(row.name || '').trim().charAt(0).toLowerCase();
    if (/[a-z]/.test(c)) set.add(c);
  }
  return [...set].sort();
}

/**
 * v59 — every cast-member slug for one letter, with NO pagination clamp.
 * `seedActorRows` caps at 200 rows because it feeds on-screen lists; a sitemap file needs the
 * whole letter (letters hold up to ~1,200 people), so the directory gets its own accessor.
 */
export function seedActorSlugs({ letter = '', minTitles = 3, limit = 40000 } = {}) {
  const index = buildCastIndex();
  const first = String(letter || '').trim().toLowerCase();
  const out = [];
  for (const row of index.values()) {
    if (row.count < minTitles) continue;
    if (first && String(row.name || '').trim().charAt(0).toLowerCase() !== first) continue;
    out.push(row);
  }
  out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return out.slice(0, Math.max(1, Math.min(40000, Number(limit) || 40000))).map((r) => r.slug);
}
