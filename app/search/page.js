import { Suspense } from 'react';
import Link from 'next/link';
import { pageMeta } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import ProductAds from '@/components/ProductAds';
import { getPosts } from '@/lib/blog';
import { getTvConfig } from '@/lib/liveTvServer';
import { getMoviesHub } from '@/lib/moviesServer';
import { SURAHS, slugOfSurah } from '@/lib/quran';
import { BOOKS } from '@/lib/hadith';
import { TOOLS } from '@/lib/tools';
import { siteSearch } from '@/lib/siteSearch';

// Search everything on Mizanora that is not a product: Movies & Series, Actors, tools, Live TV channels, Quran, Hadith, blog guides and pages.
export const dynamic = 'force-dynamic';
export const metadata = pageMeta({
  title: 'Search Mizanora',
  description: 'Search movies, series, IMDb IDs, actors, tools, Live TV channels, Quran, Hadith, guides and products on Mizanora.',
  path: '/search',
  noindex: true,
});

const Group = ({ title, children, n }) => (n ? <div className="pt-6"><h2 className="font-display text-xl font-extrabold">{title} <span className="text-sm font-semibold text-faint">({n})</span></h2><ul className="mt-2 grid gap-2 sm:grid-cols-2">{children}</ul></div> : null);
const Item = ({ href, title, sub }) => <li><Link href={href} className="block rounded-xl border border-line bg-surface p-3 hover:border-gold"><b className="text-sm">{title}</b>{sub ? <span className="mt-0.5 block text-xs text-dim">{sub}</span> : null}</Link></li>;

export default async function SearchPage({ searchParams }) {
  const sp = await searchParams;
  const q = String((sp && sp.q) || '').slice(0, 80).trim();
  let cfg = { channels: [], enabled: false };
  try { cfg = await getTvConfig(); } catch { /* no TV */ }
  let mHub = { movies: undefined, actors: undefined };
  try {
    const h = await getMoviesHub();
    if (h && h.config && h.config.enabled) mHub = { movies: h.movies, actors: h.actors };
    else mHub = { movies: [], actors: [] };
  } catch { /* fallback to built-in */ }

  const r = siteSearch(q, {
    channels: cfg.enabled ? cfg.channels : [],
    movies: mHub.movies,
    actors: mHub.actors,
    posts: getPosts(),
    surahs: SURAHS,
    books: BOOKS,
  });
  const total =
    r.movies.length +
    r.actors.length +
    r.tools.length +
    r.channels.length +
    r.posts.length +
    r.quran.length +
    r.hadith.length +
    r.pages.length;

  return (
    <>
      <PageHead title={q ? `Results for "${q}"` : 'Search Mizanora'} intro="Movies, series, actors, tools, Live TV channels, Quran, Hadith, guides and pages in one place." crumbs={[['/', 'Home'], [null, 'Search']]} />
      <section className="mx-auto max-w-4xl px-4 py-6">
        <form action="/search" method="get" className="flex gap-2" role="search">
          <input name="q" defaultValue={q} className="input" placeholder="Search: Maula Jatt, tt1375666, Fawad Khan, zakat, geo news, surah yasin..." aria-label="Search" />
          <button className="btn-gold" type="submit">Search</button>
        </form>
        {q && <p className="mt-3 text-sm"><Link className="font-bold text-gold underline" href={`/products?q=${encodeURIComponent(q)}`}>Search shop products for &quot;{q}&quot; &rarr;</Link></p>}
        {q && !total && <p className="mt-6 rounded-2xl bg-raised p-5 text-dim">Nothing found here for &quot;{q}&quot;. Try one simple word, an IMDb ID like <code>tt1375666</code>, or <Link className="font-bold text-gold underline" href={`/products?q=${encodeURIComponent(q)}`}>search the shop</Link>.</p>}
        <Group title="Movies & Series" n={r.movies.length}>
          {r.movies.map((m) => (
            <Item
              key={m.slug}
              href={`/movies/${m.slug}`}
              title={`${m.title} (${m.year})`}
              sub={`${m.region} · ${m.type === 'series' ? 'Series' : 'Movie'}${m.imdbId ? ` · ${m.imdbId}` : ''}${m.publicDomainStream ? ' · Free Legal Film' : ''}`}
            />
          ))}
        </Group>
        <Group title="Actors & Cast" n={r.actors.length}>
          {r.actors.map((a) => (
            <Item key={a.slug} href={`/movies/actor/${a.slug}`} title={a.name} sub={`${a.role} · ${a.country}`} />
          ))}
        </Group>
        <Group title="Tools" n={r.tools.length}>{r.tools.map((t) => <Item key={t.slug} href={`/tools/${t.slug}`} title={t.title} sub={t.short} />)}</Group>
        <Group title="Live TV channels" n={r.channels.length}>{r.channels.map((c) => <Item key={c.slug} href={`/live/${c.slug}`} title={c.name} sub={c.group || 'Live channel'} />)}</Group>
        <Group title="Quran" n={r.quran.length}>{r.quran.map((s) => <Item key={s.n} href={`/quran/${slugOfSurah(s.n)}`} title={`${s.n}. ${s.name}`} sub="Read and listen" />)}</Group>
        <Group title="Hadith" n={r.hadith.length}>{r.hadith.map((b) => <Item key={b[0]} href="/hadith" title={b[1]} sub={b[2]} />)}</Group>
        <Group title="Guides" n={r.posts.length}>{r.posts.map((p) => <Item key={p.slug} href={`/blog/${p.slug}`} title={p.title} sub={p.description} />)}</Group>
        <Group title="Pages" n={r.pages.length}>{r.pages.map((p) => <Item key={p[0]} href={p[0]} title={p[1]} />)}</Group>
        {!q && <div className="pt-8"><h2 className="font-display text-xl font-extrabold">Popular tools</h2><ul className="mt-2 grid gap-2 sm:grid-cols-2">{TOOLS.slice(0, 8).map((t) => <Item key={t.slug} href={`/tools/${t.slug}`} title={t.title} sub={t.short} />)}</ul></div>}
      </section>
      <Suspense fallback={null}><ProductAds seed={`search-${q}`} title="Popular on Mizanora" /></Suspense>
    </>
  );
}
