import { absUrl } from '@/lib/config';
import { getSitemapIds } from '@/lib/moviesWorld';

// Mizanora v56 — the sitemap INDEX.
//
// /sitemap.xml stays the shop's core file (products, blog, tools, Quran, live TV, pages).
// This index points at that file PLUS the title catalogue, partitioned three ways so every file is
// small, dated and obviously themed:
//
//   /sitemaps/titles-<year>.xml      one file per release year  (the canonical movie/series list)
//   /sitemaps/actors-<a…z>.xml       actor profiles, A–Z
//   /sitemaps/songs-<a…z>.xml        songs, A–Z (only listed when a mirror actually answered)
//   /sitemaps/quran.xml              the 114 surahs
//   /sitemaps/actors.xml             the actors directory page
//   /sitemaps/live.xml               live TV channels
//   /sitemaps/blog.xml               guides and news
//   /sitemaps/songs.xml              songs hub + artists + newest tracks
//
// The old movies-N / series-N chunk files still answer for anyone holding a cached index, but they
// are deliberately NOT listed here: submitting the same URL in two sitemaps is noise, and a dated
// year file is easier for Google to trust than a 20,000-row block.
export const revalidate = 21600;
export const dynamic = 'force-dynamic';

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

export async function GET() {
  const ids = await getSitemapIds().catch(() => []);
  const years = [...new Set(ids.map((x) => Number(x.year)).filter((y) => y >= 1870 && y <= 2100))].sort((a, b) => a - b);
  const hasUnknownYear = ids.some((x) => !(Number(x.year) >= 1870 && Number(x.year) <= 2100));

  // Which actor letters actually have people in them? Loading the hub is cached in memory, so this
  // is cheap — and it keeps the index free of empty files.
  let actorLetters = [];
  try {
    const { getMoviesHub } = await import('@/lib/moviesServer');
    const hub = await getMoviesHub();
    const set = new Set((hub.actors || []).map((a) => String(a.slug || '').charAt(0)).filter((c) => /[a-z]/.test(c)));
    actorLetters = LETTERS.filter((l) => set.has(l));
    // v59: the IMDb cast directory has people in nearly every letter — merge its letters in.
    const { seedActorLetters } = await import('@/lib/imdbSeed');
    const set2 = new Set([...actorLetters, ...seedActorLetters(3)]);
    actorLetters = LETTERS.filter((l) => set2.has(l));
  } catch { actorLetters = []; }

  // Songs depend on a third-party mirror; only advertise the files if the catalogue answered.
  let songLetters = [];
  try {
    const mod = await import('@/lib/songsServer');
    const data = await mod.getSongsForSitemap();
    const songs = Array.isArray(data) ? data : (data && data.songs) || [];
    const set = new Set(songs.map((s) => String(s.slug || '').charAt(0)).filter((c) => /[a-z0-9]/.test(c)));
    songLetters = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('').filter((l) => set.has(l));
  } catch { songLetters = []; }

  const now = new Date().toISOString();
  const files = [
    '/sitemap.xml',
    ...years.map((y) => `/sitemaps/titles-${y}.xml`),
    ...(hasUnknownYear ? ['/sitemaps/titles-unknown.xml'] : []),
    ...actorLetters.map((l) => `/sitemaps/actors-${l}.xml`),
    ...songLetters.map((l) => `/sitemaps/songs-${l}.xml`),
    '/sitemaps/quran.xml',
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
      'x-mizanora-sitemaps': String(files.length),
    },
  });
}
