#!/usr/bin/env node
// Mizanora v54 — build data/imdb-ids.txt from IMDb's own public dataset.
//
//   node scripts/build-imdb-ids.mjs                    # newest 500,000 titles
//   node scripts/build-imdb-ids.mjs --limit 200000     # a smaller file
//   node scripts/build-imdb-ids.mjs --min-year 2000    # only 2000 and later
//   node scripts/build-imdb-ids.mjs --types movie,series
//
// What it does:
//   1. streams https://datasets.imdbws.com/title.basics.tsv.gz (about 150 MB, no key, no login)
//   2. keeps only films and series (movie, tvMovie, series, tvSeries, tvMiniSeries, short…)
//   3. keeps the NEWEST titles first (year buckets, newest bucket first)
//   4. writes "tt1234567<TAB>movie|series<TAB>year" lines — the exact format
//      lib/moviesWorld#parseIdList reads for /sitemaps/movies-*.xml and /sitemaps/series-*.xml
//
// With MOVIES_SITEMAP_LIMIT=500000 on the deployment, every one of these titles gets a page in the
// sitemap index (25 chunk files of 20,000). The GitHub Action .github/workflows/imdb-ids.yml runs
// this weekly and commits the result, so the sitemap stays current without any server doing the work.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const LIMIT = Math.max(1000, Number(argOf('limit', 500000)) || 500000);
const MIN_YEAR = Math.max(1900, Number(argOf('min-year', 0)) || 0);
const MAX_YEAR = Number(argOf('max-year', 0)) || new Date().getFullYear() + 3;
const TYPES = new Set(String(argOf('types', 'movie,tvMovie,series,tvSeries,tvMiniSeries,short,tvShort'))
  .split(',').map((t) => t.trim()).filter(Boolean));
const OUT = path.resolve(process.cwd(), argOf('out', 'data/imdb-ids.txt'));
const URL = argOf('url', 'https://datasets.imdbws.com/title.basics.tsv.gz');

const typeOf = (imdbType) => (imdbType === 'series' || imdbType === 'tvSeries' || imdbType === 'tvMiniSeries' ? 'series' : 'movie');

async function main() {
  console.log(`IMDb ids → ${OUT}`);
  console.log(`  limit ${LIMIT.toLocaleString()} · years ${MIN_YEAR || 'any'}…${MAX_YEAR} · types ${[...TYPES].join(',')}`);
  console.log(`  source ${URL}`);

  const started = Date.now();
  const res = await fetch(URL, { headers: { 'user-agent': 'MizanoraImdbIdBuilder/54 (+https://mizanora.vercel.app)' } });
  if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status}`);

  const stream = Readable.fromWeb(res.body).pipe(createGunzip());
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const byYear = new Map(); // year -> [ "tt…\tmovie|series\t2026", … ]
  let seen = 0;
  let kept = 0;
  let header = true;

  for await (const line of rl) {
    if (header) { header = false; continue; } // tconst\ttitleType\tprimaryTitle…
    seen += 1;
    if (seen % 500000 === 0) process.stdout.write(`\r  read ${(seen / 1e6).toFixed(1)}M rows · kept ${kept.toLocaleString()}`);
    const tab1 = line.indexOf('\t');
    if (tab1 < 10) continue;
    const id = line.slice(0, tab1);
    if (!/^tt\d{6,10}$/.test(id)) continue;
    const tab2 = line.indexOf('\t', tab1 + 1);
    if (tab2 < 0) continue;
    const imdbType = line.slice(tab1 + 1, tab2);
    if (!TYPES.has(imdbType)) continue;
    // startYear is field 6 (0-based 5): tconst, titleType, primaryTitle, originalTitle, isAdult, startYear,…
    const fields = line.split('\t');
    const year = Number(fields[5]);
    if (!Number.isFinite(year) || year < MIN_YEAR || year > MAX_YEAR) continue;
    const bucket = byYear.get(year);
    const row = `${id}\t${typeOf(imdbType)}\t${year}`;
    if (bucket) bucket.push(row); else byYear.set(year, [row]);
    kept += 1;
  }

  process.stdout.write('\r');
  console.log(`  rows read ${seen.toLocaleString()} · candidates ${kept.toLocaleString()}`);

  // Newest year first, so a crawler reading only the first file still finds this year's releases.
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const out = [];
  for (const y of years) {
    const bucket = byYear.get(y);
    for (const row of bucket) {
      out.push(row);
      if (out.length >= LIMIT) break;
    }
    if (out.length >= LIMIT) break;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${out.join('\n')}\n`, 'utf8');
  const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
  console.log(`  wrote ${out.length.toLocaleString()} ids (${mb} MB) in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  console.log(`  newest title: ${out[0] ? out[0].split('\t')[0] : '—'}`);
  console.log('Done. Commit data/imdb-ids.txt, then set MOVIES_SITEMAP_LIMIT to the same number on the deployment.');
}

main().catch((err) => {
  console.error('build-imdb-ids failed:', err && err.message ? err.message : err);
  process.exit(1);
});
