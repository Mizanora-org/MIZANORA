import Link from 'next/link';
import { ExternalLink, FileText, Film, Music2, Radio, Search, Tv, Users } from 'lucide-react';
import { pageMeta } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import { absUrl } from '@/lib/config';
import { SITEMAP_CHUNK, chunkCount, getSitemapIds } from '@/lib/moviesWorld';
import { getMoviesHub } from '@/lib/moviesServer';
import { getTvConfig } from '@/lib/liveTvServer';
import { getPosts } from '@/lib/blog';
import { getSongsForSitemap } from '@/lib/songsServer';

// v55 — a human-readable map of every sitemap MIZANORA publishes.
// Google needs the XML; shop owners, developers and "why is my page not indexed?" questions need
// this page: what each file contains, how many URLs it holds, and exactly what to submit.
export const revalidate = 21600;

export const metadata = {
  ...pageMeta({
    title: 'Sitemaps — every Mizanora sitemap explained',
    description:
      'Complete list of Mizanora sitemaps: movies, series, actors, Live TV channels, blog guides, songs, singers and core pages. What each file holds, how many URLs, and how to submit them to Google Search Console.',
    path: '/sitemaps',
  }),
  robots: { index: true, follow: true },
};

const fmt = (n) => Number(n || 0).toLocaleString('en-US');

export default async function SitemapsGuidePage() {
  const ids = await getSitemapIds().catch(() => []);
  const movieCount = ids.filter((x) => x.type !== 'series').length;
  const seriesCount = ids.length - movieCount;
  const movieChunks = chunkCount(movieCount);
  const seriesChunks = chunkCount(seriesCount);

  const hub = await getMoviesHub().catch(() => ({ actors: [] }));
  const tv = await getTvConfig().catch(() => ({ channels: [] }));
  const posts = (() => { try { return getPosts(); } catch { return []; } })();
  const songData = await getSongsForSitemap().catch(() => ({ songs: [], artists: [] }));
  const songs = songData.songs || [];
  const artists = songData.artists || [];

  const rows = [
    {
      file: '/sitemap.xml',
      title: 'Core pages',
      icon: FileText,
      count: 'shop, categories, products, tools, Quran, Hadith, blog, Live TV, movies hub',
      note: 'The original sitemap. Home, every product and category, all 114 surah pages, every tool, blog posts and the main hubs.',
      priority: '1.0 – 0.5',
    },
    {
      file: '/sitemap-index.xml',
      title: 'Sitemap index',
      icon: Search,
      count: `${2 + movieChunks + seriesChunks + 4} files`,
      note: 'The entry point advertised in robots.txt. It lists /sitemap.xml and every chunk below — Google follows it automatically.',
      priority: '—',
    },
    {
      file: `/sitemaps/movies-0.xml … movies-${movieChunks - 1}.xml`,
      title: 'Movies',
      icon: Film,
      count: `${fmt(movieCount)} URLs · ${fmt(SITEMAP_CHUNK)} per file`,
      note: 'Every IMDb film we know, newest first. 20,000 URLs per file so each stays well under Google\'s 50,000 limit. You can click chunk 0 to see the current list.',
      priority: '0.7',
    },
    {
      file: `/sitemaps/series-0.xml … series-${seriesChunks - 1}.xml`,
      title: 'Series & dramas',
      icon: Tv,
      count: `${fmt(seriesCount)} URLs`,
      note: 'IMDb series and dramas, same chunking. Each page carries its season/episode guide.',
      priority: '0.7',
    },
    {
      file: '/sitemaps/actors.xml',
      title: 'Actors',
      icon: Users,
      count: `${fmt((hub.actors || []).length)} URLs`,
      note: 'Actor profiles built from the cast of every title — photo, biography and filmography.',
      priority: '0.5',
    },
    {
      file: '/sitemaps/live.xml',
      title: 'Live TV channels',
      icon: Radio,
      count: `${fmt((tv.channels || []).filter((c) => !c.off).length)} URLs`,
      note: 'Every enabled channel with its own watch page.',
      priority: '0.5',
    },
    {
      file: '/sitemaps/blog.xml',
      title: 'Blog guides',
      icon: FileText,
      count: `${fmt(posts.length)} URLs`,
      note: 'Every guide in the shopping / movies / Live TV / Islamic shelves, with its cover image.',
      priority: '0.6',
    },
    {
      file: '/sitemaps/songs.xml',
      title: 'Songs & singers',
      icon: Music2,
      count: `${fmt(songs.length + artists.length)} URLs`,
      note: 'Song pages and singer pages. Songs come from the live music catalogue, so this file grows as soon as the mirrors answer.',
      priority: '0.5 – 0.6',
    },
  ];

  return (
    <>
      <PageHead
        title="Sitemaps — har file, poori tafseel"
        intro="Google ko har page tak pohnchane ke liye Mizanora ye sitemaps publish karta hai. Neeche har file ka kaam, URL count aur submit karne ka tareeqa likha hai."
        crumbs={[['/', 'Home'], ['/sitemaps', 'Sitemaps']]}
      />

      <section className="mx-auto max-w-6xl px-3 pt-2 sm:px-4">
        <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
          <h2 className="font-display text-lg font-extrabold text-cream">Google Search Console mein sirf ek URL</h2>
          <p className="mt-1.5 text-sm leading-7 text-dim">
            Search Console → <strong className="text-cream">Sitemaps</strong> khol kar bas ye likh dein:
          </p>
          <p className="mt-2 overflow-x-auto rounded-xl bg-raised px-3 py-2 font-mono text-sm font-bold text-gold">{absUrl('/sitemap-index.xml')}</p>
          <p className="mt-2 text-sm leading-7 text-dim">
            Index khud poora catalogue khol deta hai — alag alag chunks submit karne ki zarurat nahi. Chaos na ho to
            <code className="mx-1 rounded bg-raised px-1 font-mono">{absUrl('/sitemap.xml')}</code>
            bhi submit kar sakte hain (core pages ke liye).
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-extrabold">
            <a href="/sitemap-index.xml" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-white">Open index <ExternalLink size={12} /></a>
            <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-dim hover:border-gold hover:text-gold">Core sitemap <ExternalLink size={12} /></a>
            <a href="/api/feed/google" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-dim hover:border-gold hover:text-gold">Google product feed <ExternalLink size={12} /></a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
        <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-raised text-xs uppercase tracking-wider text-faint">
              <tr>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Content</th>
                <th className="px-4 py-3">URLs</th>
                <th className="px-4 py-3">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const Icon = r.icon;
                return (
                  <tr key={r.file} className="align-top">
                    <td className="px-4 py-3">
                      <a href={r.file.includes('…') ? '/sitemaps/movies-0.xml' : r.file} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-gold hover:underline">
                        <Icon size={13} /> {r.file}
                      </a>
                      <p className="mt-1 text-[0.7rem] font-extrabold uppercase tracking-wider text-faint">{r.title}</p>
                    </td>
                    <td className="px-4 py-3 text-xs leading-6 text-dim">{r.note}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-cream">{r.count}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-dim">{r.priority}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-3 pb-16 sm:px-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
          <h2 className="font-display text-lg font-extrabold text-cream">Zyada movies kaise add karein (500,000 tak)</h2>
          <ol className="mt-2 space-y-2 text-sm leading-6 text-dim">
            <li><strong className="text-cream">1.</strong> <code className="rounded bg-raised px-1 font-mono">npm run imdb:ids</code> chalayein — IMDb ke dataset se latest 500,000 titles ki list ban jati hai.</li>
            <li><strong className="text-cream">2.</strong> <code className="rounded bg-raised px-1 font-mono">data/imdb-ids.txt</code> commit karein (weekly GitHub Action ye khud karta hai).</li>
            <li><strong className="text-cream">3.</strong> Deployment par <code className="rounded bg-raised px-1 font-mono">MOVIES_SITEMAP_LIMIT=500000</code> set karein.</li>
            <li><strong className="text-cream">4.</strong> <code className="rounded bg-raised px-1 font-mono">/sitemap-index.xml</code> dobara khol kar dekhein — chunks khud barh jaate hain.</li>
          </ol>
        </article>
        <article className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
          <h2 className="font-display text-lg font-extrabold text-cream">Index hone ke liye checklist</h2>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-dim">
            <li>• Search Console mein property verify karein (DNS ya HTML tag).</li>
            <li>• Sitemap submit karein, phir <strong className="text-cream">URL Inspection</strong> se 2–3 movie pages manually &quot;Request indexing&quot; karein.</li>
            <li>• Har movie page par unique title, description, poster, `Movie`/`TVSeries` JSON-LD — sab maujood hai.</li>
            <li>• Songs/Singers pages `MusicRecording` / `MusicGroup` schema ke saath aate hain.</li>
            <li>• Sitemap <code className="rounded bg-raised px-1 font-mono">lastmod</code> har refresh par update hota hai; 6 ghante CDN cache.</li>
          </ul>
          <p className="mt-3 text-xs leading-6 text-faint">
            Detail guide: repo ki <strong className="text-dim">SITEMAPS.md</strong> file.
          </p>
        </article>
      </section>

      <p className="mx-auto max-w-6xl px-3 pb-10 text-xs text-faint sm:px-4">
        Movies aur series ka data IMDb (Cinemeta) aur committed IMDb snapshot se aata hai. Songs teesre
        darje ke music catalogue se stream hote hain; Mizanora unhe host nahi karta.
      </p>
    </>
  );
}
