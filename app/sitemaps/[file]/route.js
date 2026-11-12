import { absUrl } from '@/lib/config';
import { SITEMAP_CHUNK, getSitemapIds } from '@/lib/moviesWorld';
import { SURAHS, slugOfSurah } from '@/lib/quran';
import { sitemapLastmod } from '@/lib/sitemapVersion';

// Mizanora v54 — sitemap files.
//
//   /sitemaps/movies-0.xml … movies-N.xml   every IMDb movie (pool from lib/moviesWorld)
//   /sitemaps/series-0.xml … series-N.xml   every series/drama
//   /sitemaps/actors.xml                    actor profiles
//   /sitemaps/live.xml                      live TV channels
//   /sitemaps/blog.xml                      guides & news
//   /sitemaps/songs.xml                     songs (v54 song section)
//
// /sitemap-index.xml lists all of them; /sitemap.xml keeps the shop's core pages.
// The movie chunks crawl the IMDb catalogue, so they must be produced at request time
// (build machines are often offline). v62: the CDN keeps each file for a WEEK (was six hours),
// which matches the weekly `imdb-ids` data refresh and cuts sitemap origin transfers ~28x.
// `lastmod` is now a stable data date, not "today", so an unchanged file is byte-identical and
// Google is not told to re-crawl 40,000 URLs four times a day for no reason.
export const dynamic = 'force-dynamic';

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const urlTag = (path, { lastmod = '', changefreq = 'weekly', priority = '0.6' } = {}) => `  <url>\n    <loc>${esc(absUrl(path))}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

const xml = (entries) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

export async function GET(request, context) {
  const { file } = await context.params;
  const name = String(file || '').replace(/\.xml$/i, '');
  // v62: stable date of the underlying data. See lib/sitemapVersion.js.
  const today = sitemapLastmod();
  let entries = [];

  const chunkMatch = name.match(/^(movies|series)-(\d+)$/);
  if (chunkMatch) {
    const [, kind, rawIndex] = chunkMatch;
    const index = Math.max(0, Number(rawIndex) || 0);
    const ids = await getSitemapIds().catch(() => []);
    const pool = ids.filter((x) => (kind === 'series' ? x.type === 'series' : x.type !== 'series'));
    const slice = pool.slice(index * SITEMAP_CHUNK, (index + 1) * SITEMAP_CHUNK);
    entries = slice.map((x) => urlTag(`/movies/${x.id}`, {
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.7',
    }));
  } else if (name === 'titles-unknown') {
    // v59 — a handful of ids in the pool have no year at all. Before this they silently fell out of
    // every year file; now they are still crawlable.
    const ids = await getSitemapIds().catch(() => []);
    entries = ids
      .filter((x) => !(Number(x.year) >= 1870 && Number(x.year) <= 2100))
      .slice(0, 45000)
      .map((x) => urlTag(`/movies/${x.id}`, { lastmod: today, changefreq: 'weekly', priority: '0.6' }));
  } else if (/^titles-\d{4}$/.test(name)) {
    // v56 — one file per release year. This is the canonical partition now: a sitemap chunk that
    // mixes 1930s films with 2026 series tells Google nothing, while `titles-2026.xml` is a clean,
    // small, dated list. (The old movies-N / series-N files still answer, but they are no longer
    // listed in the index, so the same URL is never submitted twice.)
    const year = Number(name.slice(7));
    const ids = await getSitemapIds().catch(() => []);
    entries = ids
      .filter((x) => Number(x.year) === year)
      .slice(0, 45000)
      .map((x) => urlTag(`/movies/${x.id}`, { lastmod: today, changefreq: 'weekly', priority: year >= new Date().getFullYear() ? 0.8 : 0.7 }));
  } else if (/^actors-[a-z]$/.test(name)) {
    // A–Z actor files: small, obviously-themed lists are crawled far more reliably than one 40k file.
    // v59 also lists the IMDb cast directory (10k+ people with 3+ titles), not just curated profiles.
    const letter = name.slice(7);
    const seenActor = new Set();
    const rows = [];
    try {
      const { getMoviesHub } = await import('@/lib/moviesServer');
      const hub = await getMoviesHub();
      for (const a of (hub.actors || [])) {
        const slug = String(a.slug || '');
        if (!slug.startsWith(letter) || seenActor.has(slug)) continue;
        seenActor.add(slug);
        rows.push(slug);
      }
    } catch { /* curated list unavailable */ }
    try {
      // v59 — the whole letter (up to ~1,200 people), not the first 200 rows.
      const { seedActorSlugs } = await import('@/lib/imdbSeed');
      for (const slug of seedActorSlugs({ letter, minTitles: 3, limit: 40000 })) {
        if (seenActor.has(slug)) continue;
        seenActor.add(slug);
        rows.push(slug);
      }
    } catch { /* snapshot unavailable */ }
    entries = rows.slice(0, 40000).map((slug) => urlTag(`/movies/actor/${slug}`, { lastmod: today, changefreq: 'monthly', priority: '0.5' }));
  } else if (/^songs-[a-z0-9]$/.test(name)) {
    const letter = name.slice(6);
    try {
      const mod = await import('@/lib/songsServer');
      const data = await mod.getSongsForSitemap();
      const songs = Array.isArray(data) ? data : (data && data.songs) || [];
      entries = songs
        .filter((sg) => String(sg.slug || '').startsWith(letter))
        .slice(0, 40000)
        .map((sg) => urlTag(`/songs/${sg.slug}`, { lastmod: today, changefreq: 'monthly', priority: '0.5' }));
    } catch { entries = []; }
  } else if (name === 'quran') {
    entries = SURAHS.map((x) => urlTag(`/quran/${slugOfSurah(x.n)}`, { lastmod: today, changefreq: 'yearly', priority: '0.5' }));
  } else if (name === 'actors') {
    const seenActor = new Set();
    const slugs = [];
    try {
      const { getMoviesHub } = await import('@/lib/moviesServer');
      const hub = await getMoviesHub();
      for (const a of (hub.actors || [])) {
        if (!a || !a.slug || seenActor.has(a.slug)) continue;
        seenActor.add(a.slug);
        slugs.push(a.slug);
      }
    } catch { /* ignore */ }
    try {
      // v59 — actors.xml is the full directory page: every snapshot cast member, not 200 of them.
      const { seedActorSlugs } = await import('@/lib/imdbSeed');
      for (const slug of seedActorSlugs({ minTitles: 3, limit: 40000 })) {
        if (seenActor.has(slug)) continue;
        seenActor.add(slug);
        slugs.push(slug);
      }
    } catch { /* ignore */ }
    entries = slugs.slice(0, 40000).map((slug) => urlTag(`/movies/actor/${slug}`, { lastmod: today, changefreq: 'monthly', priority: '0.5' }));
  } else if (name === 'live') {
    try {
      const { getTvConfig } = await import('@/lib/liveTvServer');
      const { channelSlugs } = await import('@/lib/liveTv');
      const cfg = await getTvConfig();
      const slugs = channelSlugs(cfg.channels || []);
      entries = (cfg.channels || [])
        .map((c, i) => (c.off ? null : urlTag(`/live/${slugs[i]}`, { lastmod: today, changefreq: 'weekly', priority: '0.5' })))
        .filter(Boolean)
        .slice(0, 40000);
    } catch { entries = []; }
  } else if (name === 'blog') {
    try {
      const { getPosts } = await import('@/lib/blog');
      entries = getPosts().slice(0, 40000).map((p) => urlTag(`/blog/${p.slug}`, {
        lastmod: (p.date || today).slice(0, 10),
        changefreq: 'monthly',
        priority: '0.6',
      }));
    } catch { entries = []; }
  } else if (name === 'songs') {
    try {
      const mod = await import('@/lib/songsServer');
      const data = await mod.getSongsForSitemap();
      const songs = Array.isArray(data) ? data : (data && data.songs) || [];
      const artists = Array.isArray(data && data.artists) ? data.artists : [];
      entries = [
        ...artists.slice(0, 2000).map((a) => urlTag(`/songs/artist/${a.slug}`, { lastmod: today, changefreq: 'weekly', priority: '0.6' })),
        ...songs.slice(0, 38000).map((s) => urlTag(`/songs/${s.slug}`, { lastmod: today, changefreq: 'monthly', priority: '0.5' })),
      ];
    } catch { entries = []; }
  } else {
    return new Response('Not found', { status: 404 });
  }

  return new Response(xml(entries), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // v62: one generation per file per week instead of four per day. `max-age` also lets a
      // browser keep its copy for a day (the old `max-age=0` revalidated on EVERY request).
      'cache-control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
    },
  });
}
