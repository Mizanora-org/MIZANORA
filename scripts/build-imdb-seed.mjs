#!/usr/bin/env node
// Mizanora v55 — build the OFFLINE IMDb snapshot.
//
// Why this exists:
//   * v54 read every movie from Cinemeta (IMDb) at request time. That is perfect on the deployed
//     site, but a build machine, a preview sandbox, or a moment when Cinemeta is slow/blocked left
//     /movies, /search, /movies/calendar and the sitemap EMPTY — which is exactly what happened.
//   * A snapshot committed to the repo means the catalogue, the search, the calendar and the
//     sitemap all work even with no internet, and Cinemeta simply supersedes it when reachable.
//
// Sources (both free, no key):
//   1. movies  — the Kaggle "IMDb movies" dataset (85,855 films, CC0 factual metadata). This file
//                ships a filtered copy of the same columns; pass --csv to use your own copy.
//                Default download URL (GitHub mirror of that dataset):
//                https://raw.githubusercontent.com/sahildit/IMDB-Movies-Extensive-Dataset-Analysis/master/data1/IMDb%20movies.csv
//   2. series  — a folder of Stremio-style `{"meta":{...}}` JSON files (one per series). Pass
//                --series-dir ./path. Without it, only the movies are rebuilt.
//
// Output:
//   data/imdb-seed.json  — ~16,000 movies + ~1,000 series with poster-free facts (the poster is
//                          built from the IMDb id at render time: images.metahub.space/poster/…)
//   data/imdb-ids.txt    — EVERY id we know, newest first, in the format lib/moviesWorld parses
//                          (tt1234567 <TAB> movie|series <TAB> year). The sitemap chunks read this.
//
//   node scripts/build-imdb-seed.mjs --csv /tmp/imdb_movies.csv --series-dir /tmp/nf/raw
//   node scripts/build-imdb-seed.mjs              # downloads the CSV itself (needs internet)

import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const argOf = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const CSV_URL = argOf('csv-url', 'https://raw.githubusercontent.com/sahildit/IMDB-Movies-Extensive-Dataset-Analysis/master/data1/IMDb%20movies.csv');
const CSV_PATH = argOf('csv', '');
const SERIES_DIR = argOf('series-dir', '');
const MIN_VOTES = Math.max(0, Number(argOf('min-votes', 3000)) || 3000);
const MAX_MOVIES = Math.max(100, Number(argOf('max-movies', 20000)) || 20000);
const SEED_OUT = path.resolve(ROOT, argOf('out', 'data/imdb-seed.json'));
const IDS_OUT = path.resolve(ROOT, argOf('ids-out', 'data/imdb-ids.txt'));

// Spanish -> English for the series metas (the default series source is a Spanish Stremio addon).
const GENRE_MAP = {
  'acción': 'Action', 'accion': 'Action', 'aventura': 'Adventure', 'action & adventure': 'Action & Adventure',
  'animación': 'Animation', 'animacion': 'Animation', 'comedia': 'Comedy', 'crimen': 'Crime',
  'documental': 'Documentary', 'drama': 'Drama', 'familia': 'Family', 'fantasía': 'Fantasy', 'fantasia': 'Fantasy',
  'historia': 'History', 'terror': 'Horror', 'música': 'Music', 'musica': 'Music', 'misterio': 'Mystery',
  'romance': 'Romance', 'ciencia ficción': 'Science Fiction', 'ciencia ficcion': 'Science Fiction',
  'sci-fi & fantasy': 'Science Fiction', 'suspense': 'Thriller', 'guerra': 'War', 'guerra y política': 'War & Politics',
  'war & politics': 'War & Politics', 'western': 'Western', 'bélica': 'War', 'belica': 'War',
  'infantil': 'Family', 'kids': 'Family', 'biografía': 'Biography', 'biografia': 'Biography', 'talk': 'Talk',
  'tv movie': 'TV Movie', 'noticias': 'News', 'reality': 'Reality',
};
const enGenre = (g) => {
  const raw = String(g || '').trim();
  if (!raw) return '';
  const mapped = GENRE_MAP[raw.toLowerCase()];
  if (mapped) return mapped;
  return /^[a-z0-9 &'.-]+$/i.test(raw) ? raw : '';
};

const ENGLISH_HINT = /\b(the|and|of|a|an|is|in|to|with|his|her|their|after|who|when|from|for|by|on|as|that|this|it|he|she|they)\b/i;
const looksEnglish = (text) => {
  const s = String(text || '');
  if (s.length < 40) return false;
  const spanish = /\b(el|la|los|las|una|un|de|del|que|con|por|para|su|sus|como|más|pero|cuando|donde|mientras|es|son|ha|fue|ser)\b/gi;
  const hits = (s.match(spanish) || []).length;
  return ENGLISH_HINT.test(s) && hits < 4;
};

/** A tiny CSV reader that understands quoted fields, escaped quotes and newlines inside quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else { quoted = false; }
      } else { field += ch; }
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (ch === '\r') continue;
    field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const clean = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);
const list = (s, max) => String(s || '').split(',').map((x) => clean(x, 60)).filter((x) => x && x.toLowerCase() !== 'none').slice(0, max);
const yearOf = (s) => {
  const n = Number(String(s || '').slice(0, 4));
  return Number.isFinite(n) && n >= 1870 && n <= 2100 ? n : 0;
};
const endYearOf = (s) => {
  const m = String(s || '').match(/(\d{4})\s*[–-]\s*(\d{4})/);
  return m ? Number(m[2]) : yearOf(s);
};

async function readCsv() {
  if (CSV_PATH) {
    console.log(`  movies: ${CSV_PATH}`);
    return fs.readFileSync(CSV_PATH, 'utf8');
  }
  console.log(`  movies: downloading ${CSV_URL}`);
  const res = await fetch(CSV_URL, { headers: { 'user-agent': 'MizanoraSeed/55' } });
  if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status}`);
  const chunks = [];
  for await (const chunk of Readable.fromWeb(res.body)) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function buildMovies(csvText) {
  const rows = parseCsv(csvText);
  const header = rows.shift().map((h) => h.trim().toLowerCase());
  const col = (name) => header.indexOf(name);
  const C = {
    id: col('imdb_title_id'), title: col('title'), original: col('original_title'),
    year: col('year'), genre: col('genre'),
    duration: col('duration'), country: col('country'), language: col('language'),
    director: col('director'), actors: col('actors'), description: col('description'),
    vote: col('avg_vote'), votes: col('votes'),
  };
  if (C.id < 0 || C.title < 0) throw new Error('CSV is not the IMDb movies dataset (imdb_title_id/title missing)');

  const movies = [];
  const ids = [];
  for (const r of rows) {
    if (!r || r.length < header.length - 3) continue;
    const id = String(r[C.id] || '').trim().toLowerCase();
    if (!/^tt\d{6,10}$/.test(id)) continue;
    // The Kaggle export localises `title` (Italian for many rows) while `original_title` keeps the
    // real IMDb original title. Use the original for display, keep the other as an alias for search.
    const original = C.original >= 0 ? clean(r[C.original], 140) : '';
    const localised = clean(r[C.title], 140);
    const title = original || localised;
    if (!title) continue;
    const alt = localised && localised.toLowerCase() !== title.toLowerCase() ? localised : '';
    const year = yearOf(r[C.year]);
    const votes = Number(r[C.votes]) || 0;
    ids.push({ id, type: 'movie', year, votes });

    if (votes < MIN_VOTES || movies.length >= MAX_MOVIES) continue;
    movies.push({
      i: id,
      t: title,
      ...(alt ? { a: alt } : {}),
      y: year,
      g: list(r[C.genre], 5).map(enGenre).filter(Boolean),
      r: Math.round((Number(r[C.vote]) || 0) * 10) / 10,
      d: Math.max(0, Number(r[C.duration]) || 0),
      c: clean(r[C.country], 60),
      l: clean(r[C.language], 40),
      dir: clean(r[C.director], 100),
      ca: list(r[C.actors], 8),
      s: clean(r[C.description], 420),
    });
  }
  movies.sort((a, b) => b.y - a.y || b.r - a.r);
  return { movies, ids };
}

function buildSeries(dir) {
  const series = [];
  const ids = [];
  if (!dir || !fs.existsSync(dir)) return { series, ids };
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); } catch { continue; }
    const meta = data && (data.meta || data);
    if (!meta || meta.type !== 'series') continue;
    const id = String(meta.id || '').trim().toLowerCase();
    if (!/^tt\d{6,10}$/.test(id)) continue;
    const name = clean(meta.name, 140);
    if (!name) continue;
    const year = yearOf(meta.releaseInfo) || endYearOf(meta.releaseInfo);
    ids.push({ id, type: 'series', year, votes: 0 });
    const desc = looksEnglish(meta.description) ? clean(meta.description, 420) : '';
    const rating = Number(meta?.app_extras?.ratings?.tmdb?.rating) || 0;
    series.push({
      i: id,
      t: name,
      y: year,
      g: (Array.isArray(meta.genres) ? meta.genres : []).map(enGenre).filter(Boolean).slice(0, 5),
      r: rating ? Math.round(rating * 10) / 10 : 0,
      d: 0,
      c: '',
      l: '',
      dir: '',
      ca: [],
      s: desc,
    });
  }
  series.sort((a, b) => b.y - a.y || b.r - a.r);
  return { series, ids };
}

async function main() {
  console.log('Mizanora IMDb snapshot');
  const started = Date.now();
  const csv = await readCsv();
  const { movies, ids: movieIds } = buildMovies(csv);
  console.log(`  movies kept: ${movies.length.toLocaleString()} (votes >= ${MIN_VOTES}) · ids: ${movieIds.length.toLocaleString()}`);
  const { series, ids: seriesIds } = buildSeries(SERIES_DIR);
  console.log(`  series kept: ${series.length.toLocaleString()}${SERIES_DIR ? '' : ' (no --series-dir given)'}`);

  const seed = {
    v: 55,
    generated: new Date().toISOString().slice(0, 10),
    source: 'IMDb public dataset (factual metadata)',
    movies,
    series,
  };
  fs.mkdirSync(path.dirname(SEED_OUT), { recursive: true });
  fs.writeFileSync(SEED_OUT, JSON.stringify(seed));
  const seedMb = (fs.statSync(SEED_OUT).size / 1024 / 1024).toFixed(1);

  // Newest first, so a crawler that reads only chunk 0 still finds the newest titles.
  const all = [...movieIds, ...seriesIds].sort((a, b) => (b.year || 0) - (a.year || 0) || b.votes - a.votes);
  const seen = new Set();
  const lines = [];
  for (const x of all) {
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    lines.push(`${x.id}\t${x.type}\t${x.year || ''}`);
  }
  fs.writeFileSync(IDS_OUT, `${lines.join('\n')}\n`);
  const idsMb = (fs.statSync(IDS_OUT).size / 1024 / 1024).toFixed(1);

  console.log(`  wrote ${SEED_OUT} (${seedMb} MB) and ${IDS_OUT} (${lines.length.toLocaleString()} ids, ${idsMb} MB)`);
  console.log(`  newest: ${movies[0] ? `${movies[0].t} (${movies[0].y})` : '—'} · done in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

main().catch((err) => {
  console.error('build-imdb-seed failed:', err && err.message ? err.message : err);
  process.exit(1);
});
