import { absUrl } from '@/lib/config';
import { chunkCount, getSitemapIds } from '@/lib/moviesWorld';

// Mizanora v54 — the sitemap INDEX.
//
// /sitemap.xml (the core pages: shop, blog, tools, Quran, live TV …) stays exactly as it was.
// This index points at that file AND at the movie/series chunks that the IMDb catalogue fills.
// A sitemap file may hold 50,000 addresses; we use 20,000 per chunk, so even a 500,000-title
// pool (MOVIES_SITEMAP_LIMIT=500000) is a valid set of index entries.
export const revalidate = 21600; // six hours
export const dynamic = 'force-dynamic';

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET() {
  const ids = await getSitemapIds().catch(() => []);
  const movies = ids.filter((x) => x.type !== 'series').length;
  const series = ids.length - movies;
  const movieChunks = Math.max(1, chunkCount(movies));
  const seriesChunks = Math.max(1, chunkCount(series));
  const now = new Date().toISOString();

  const files = [
    '/sitemap.xml',
    ...Array.from({ length: movieChunks }, (_, i) => `/sitemaps/movies-${i}.xml`),
    ...Array.from({ length: seriesChunks }, (_, i) => `/sitemaps/series-${i}.xml`),
    '/sitemaps/actors.xml',
    '/sitemaps/live.xml',
    '/sitemaps/blog.xml',
    '/sitemaps/songs.xml',
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${files.map((f) => `  <sitemap>\n    <loc>${esc(absUrl(f))}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`).join('\n')}
</sitemapindex>
`;

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400',
    },
  });
}
