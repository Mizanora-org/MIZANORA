// Mizanora v56 — the committed IMDb id pool (`data/imdb-ids.txt`), indexed in memory.
//
// `imdb-ids.txt` is one tab-separated line per title: `tt1234567<TAB>movie|series<TAB>year`. It is
// what makes the sitemap 86,783 URLs wide. Until v56 the app only used it as a list; now it also
// answers "what is this id?" so a page whose metadata could not be fetched still knows whether it is
// a film or a series and which year it belongs to — a small thing that turns a blank page into a
// useful one.
//
// The file is read once per process (a few MB) and cached; a missing file is not an error.
import fs from 'node:fs';
import path from 'node:path';

let cache = null; // Map<id, { type, year }>

function load() {
  if (cache) return cache;
  cache = new Map();
  try {
    const file = path.join(process.cwd(), 'data', 'imdb-ids.txt');
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split('\n')) {
      if (!line) continue;
      const [id, type, year] = line.split('\t');
      const key = String(id || '').trim().toLowerCase();
      if (!/^tt\d{6,10}$/.test(key)) continue;
      cache.set(key, {
        type: type === 'series' ? 'series' : 'movie',
        year: Math.max(0, Number(year) || 0),
      });
    }
  } catch {
    /* no committed pool — everything below degrades to "unknown" */
  }
  return cache;
}

/** { type, year } for an IMDb id, or null when the id is not in the pool. */
export function idInfo(rawId) {
  const key = String(rawId || '').trim().toLowerCase();
  if (!/^tt\d{6,10}$/.test(key)) return null;
  return load().get(key) || null;
}

/** How many ids are in the pool (0 when the file is missing). */
export function idCount() {
  return load().size;
}

/** Count by type, used by sitemap index and the coverage report. */
export function idBreakdown() {
  let movies = 0;
  let series = 0;
  for (const v of load().values()) {
    if (v.type === 'series') series += 1;
    else movies += 1;
  }
  return { movies, series, total: movies + series };
}
