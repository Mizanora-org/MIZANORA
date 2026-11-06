import { absUrl } from '@/lib/config';
import { SITEMAP_CHUNK, getSitemapIds } from '@/lib/moviesWorld';

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
// (build machines are often offline). The CDN keeps each file for six hours.
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
  const today = new Date().toISOString().slice(0, 10);
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
  } else if (name === 'actors') {
    try {
      const { getMoviesHub } = await import('@/lib/moviesServer');
      const hub = await getMoviesHub();
      entries = (hub.actors || []).slice(0, 40000).map((a) => urlTag(`/movies/actor/${a.slug}`, { lastmod: today, changefreq: 'monthly', priority: '0.5' }));
    } catch { entries = []; }
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
      const songs = await mod.getSongsForSitemap();
      entries = (songs || []).slice(0, 40000).map((s) => urlTag(`/songs/${s.slug}`, { lastmod: today, changefreq: 'monthly', priority: '0.5' }));
    } catch { entries = []; }
  } else {
    return new Response('Not found', { status: 404 });
  }

  return new Response(xml(entries), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400',
    },
  });
}
