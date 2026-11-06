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
import { coverage, coverageVerdict } from '@/lib/coverage';
import { seedActorLetters, seedCastSize } from '@/lib/imdbSeed';

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
  // v56 — the catalogue is now published one file per release year, plus A–Z actor/song files.
  const years = [...new Set(ids.map((x) => Number(x.year)).filter((y) => y >= 1870 && y <= 2100))].sort((a, b) => a - b);

  const hub = await getMoviesHub().catch(() => ({ actors: [] }));
  const tv = await getTvConfig().catch(() => ({ channels: [] }));
  const posts = (() => { try { return getPosts(); } catch { return []; } })();
  const songData = await getSongsForSitemap().catch(() => ({ songs: [], artists: [] }));
  const songs = songData.songs || [];
  const artists = songData.artists || [];
  // v59 — merge the hub's curated actors with the IMDb cast snapshot, exactly like the sitemap
  // index does, so this page never under-reports the number of files Google will be given.
  const actorSet = new Set((hub.actors || []).map((a) => String(a.slug || '').charAt(0)).filter((c) => /[a-z]/.test(c)));
  try { for (const l of seedActorLetters(3)) actorSet.add(l); } catch { /* snapshot missing */ }
  const actorLetters = [...actorSet].sort();
  const hasUnknownYear = ids.some((x) => !(Number(x.year) >= 1870 && Number(x.year) <= 2100));
  const songLetters = [...new Set(songs.map((x) => String(x.slug || '').charAt(0)).filter((c) => /[a-z0-9]/.test(c)))].sort();
  const fileCount = 1 + years.length + (hasUnknownYear ? 1 : 0) + actorLetters.length + songLetters.length + 5;
  const cov = coverage();
  const verdict = coverageVerdict(cov);

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
      count: `${fileCount} files`,
      note: 'Robots.txt advertises this one file. Search Console mein sirf yehi submit karein.',
      note: 'The entry point advertised in robots.txt. It lists /sitemap.xml and every chunk below — Google follows it automatically.',
      priority: '—',
    },
    {
      file: years.length ? `/sitemaps/titles-${years[years.length - 1]}.xml … titles-${years[0]}.xml` : '/sitemaps/titles-2026.xml',
      title: 'Movies & series by release year',
      icon: Film,
      count: `${fmt(ids.length)} URLs · ${years.length} files · ${fmt(movieCount)} films + ${fmt(seriesCount)} series`,
      note: 'v56: the catalogue is split one file per release year (titles-1999.xml, titles-2026.xml …). Small dated lists are crawled far more reliably than 20,000-row blocks. The old movies-N / series-N files still answer but are no longer listed, so no URL is submitted twice.',
      priority: '0.7 – 0.8',
    },
    ...(hasUnknownYear ? [{
      file: '/sitemaps/titles-unknown.xml',
      title: 'Titles without a usable year',
      icon: Film,
      count: `${fmt(ids.filter((x) => !(Number(x.year) >= 1870 && Number(x.year) <= 2100)).length)} URLs · 1 file`,
      note: 'v59: a handful of catalogue ids have no release year, so they can never belong to a titles-YEAR file. They used to fall out of the sitemap entirely; now they get their own file.',
      priority: '0.7',
    }] : []),
    {
      file: actorLetters.length ? `/sitemaps/actors-a.xml … actors-${actorLetters[actorLetters.length - 1]}.xml` : '/sitemaps/actors.xml',
      title: 'Actor profiles A–Z',
      icon: Users,
      count: `${fmt(seedCastSize(3))} cast + ${fmt((hub.actors || []).length)} curated · ${actorLetters.length} files`,
      note: 'Every actor page, one file per starting letter, so a crawl never depends on one huge list.',
      priority: '0.5',
    },
    {
      file: songLetters.length ? `/sitemaps/songs-a.xml … songs-${songLetters[songLetters.length - 1]}.xml` : '/sitemaps/songs.xml',
      title: 'Songs A–Z',
      icon: Music2,
      count: `${fmt(songs.length)} URLs · ${songLetters.length} files`,
      note: 'Only listed when a music mirror actually answered on the last build — an empty file is worse than no file.',
      priority: '0.5',
    },
    {
      file: '/sitemaps/quran.xml',
      title: 'Quran (114 surahs)',
      icon: FileText,
      count: '114 URLs',
      note: 'Every surah page with Urdu translation and ayah-by-ayah recitation.',
      priority: '0.5',
    },
    {
      file: '/sitemaps/actors.xml',
      title: 'Actors',
      icon: Users,
      count: `${fmt(seedCastSize(3) + (hub.actors || []).length)} URLs (cast + curated)`,
      note: 'The whole directory in one file: every snapshot cast member with 3+ titles plus the curated profiles.',
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

      {/* v56 — the honest coverage card: how many advertised pages actually have data behind them */}
      <section className="mx-auto max-w-6xl px-3 pt-2 sm:px-4">
        <div className={`rounded-3xl border p-5 shadow-sm ${
          verdict.tone === 'green' ? 'border-emerald-300 bg-emerald-50' : verdict.tone === 'red' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'
        }`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-extrabold text-cream">Coverage — kitne pages ke peeche asli data hai</h2>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-[#0B3D28]">{cov.withDataPct}% bhare hue</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            {[
              ['Sitemap ids', fmt(cov.sitemapIds)],
              ['Snapshot titles', fmt(cov.seeded)],
              ['Live IMDb par depend', fmt(cov.missing)],
              ['Files in index', fmt(fileCount)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-white/70 px-3 py-2">
                <p className="text-[0.62rem] font-extrabold uppercase tracking-wider text-faint">{k}</p>
                <p className="font-display text-lg font-extrabold tabular-nums text-cream">{v}</p>
              </div>
            ))}
          </div>
          <p className="mt-2.5 text-sm font-semibold leading-6 text-cream/85">{verdict.text}</p>
          <p className="mt-1 text-xs leading-6 text-dim">
            <b>SITEMAP_DATA_ONLY=1</b> set karein to index sirf un titles ko list karega jinka data commit hai
            (abhi {fmt(cov.seeded)}), aur baqi Cinemeta live hone par khud wapas aa jayenge. Har khali page ab
            ek useful “data pending” page dikhata hai (search + popular titles), Google ke liye noindex.
          </p>
        </div>
      </section>

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
            <li><strong className="text-cream">Abhi:</strong> committed pool <b className="text-cream">{fmt(ids.length)}</b> titles (films + series) hai, aur sitemap un sab ko list karta hai.</li>
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
