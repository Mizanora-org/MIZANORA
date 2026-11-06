// Mizanora v56 — how much of the sitemap actually has data behind it.
//
// This is the honest answer to the question "kaun se page khali hain?". The sitemap advertises every
// IMDb id in `data/imdb-ids.txt`; the pages that can render *without* the internet are the ones in
// `data/imdb-seed.json`. The two numbers are different, and pretending otherwise is how thin pages
// reach Google.
//
// `coverage()` is cheap (two in-memory indexes) and is shown on /sitemaps and /admin/traffic.
import { idCount, idBreakdown } from './imdbIds';
import { seedSize } from './imdbSeed';

export function coverage() {
  const ids = idBreakdown();
  const seed = seedSize();
  const seeded = seed.movies + seed.series;
  const total = ids.total || idCount();
  const missing = Math.max(0, total - seeded);
  return {
    sitemapIds: total,
    movies: ids.movies,
    series: ids.series,
    seeded,
    seededMovies: seed.movies,
    seededSeries: seed.series,
    missing,
    withDataPct: total ? Math.round((seeded / total) * 1000) / 10 : 0,
    snapshotGenerated: seed.generated || '',
  };
}

/** A plain-language verdict for the UI. */
export function coverageVerdict(c = coverage()) {
  if (!c.sitemapIds) return { tone: 'amber', text: 'IMDb id pool missing — sitemap will fall back to the live crawl.' };
  if (c.withDataPct >= 90) return { tone: 'green', text: 'Har sitemap page ke peeche data maujood hai.' };
  if (c.withDataPct >= 50) return { tone: 'amber', text: `${100 - c.withDataPct}% pages live IMDb par depend karte hain.` };
  return {
    tone: 'red',
    text: `Sirf ${c.withDataPct}% pages ke paas committed data hai — baqi ${c.missing.toLocaleString('en-US')} pages IMDb live hone par hi bharte hain. Sitemap quality mode on karein (SITEMAP_DATA_ONLY=1).`,
  };
}
