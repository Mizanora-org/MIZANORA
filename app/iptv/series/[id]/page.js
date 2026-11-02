import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Play, Star, Tv } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import JsonLd from '@/components/JsonLd';
import { findPublicSeries, getPublicLibrary } from '@/lib/iptvPublic';

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { id } = await params;
  const s = await findPublicSeries(id);
  if (!s) return pageMeta({ title: 'Series not found', description: 'Yeh series library mein nahi mili.', path: `/iptv/series/${id}`, noindex: true });
  return pageMeta({
    title: `${s.name} — seasons aur episodes · Mizanora IPTV`,
    description: `${s.name}: ${s.seasons} season, ${s.episodes} episodes. Mizanora IPTV ki series library — browser player ya Xtream apps par chalayein.`,
    path: `/iptv/series/${id}`,
    ...(s.poster ? { image: s.poster } : {}),
  });
}

export default async function SeriesDetail({ params }) {
  const { id } = await params;
  const s = await findPublicSeries(id);
  if (!s) notFound();
  const lib = await getPublicLibrary();
  const related = lib.series.filter((x) => x.id !== s.id && x.group === s.group).slice(0, 10);

  const ld = [
    breadcrumbJsonLd([['/', 'Home'], ['/iptv', 'IPTV'], ['/iptv/series', 'Series'], [`/iptv/series/${id}`, s.name]]),
    {
      '@context': 'https://schema.org',
      '@type': 'TVSeries',
      name: s.name,
      numberOfSeasons: s.seasons,
      numberOfEpisodes: s.episodes,
      ...(s.plot ? { description: s.plot } : {}),
      ...(s.poster ? { image: s.poster } : {}),
      ...(s.group ? { genre: s.group } : {}),
      ...(s.imdbId ? { sameAs: `https://www.imdb.com/title/${s.imdbId}/` } : {}),
      url: absUrl(`/iptv/series/${id}`),
      containsSeason: s.seasonList.map((x) => ({ '@type': 'TVSeason', seasonNumber: x.n, numberOfEpisodes: x.episodes.length })),
    },
  ];

  return (
    <>
      <JsonLd data={ld} />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <nav className="mb-4 text-[11px] text-faint">
          <Link href="/iptv" className="hover:text-gold">IPTV</Link> · <Link href="/iptv/series" className="hover:text-gold">Series</Link> · <span className="text-dim">{s.name}</span>
        </nav>

        <div className="grid gap-5 sm:grid-cols-[15rem_1fr]">
          <div className="overflow-hidden rounded-2xl border border-line bg-raised">
            {s.poster ? <img src={s.poster} alt={s.name} className="aspect-[2/3] w-full object-cover" /> : <div className="grid aspect-[2/3] place-items-center text-faint"><Tv size={32} /></div>}
          </div>
          <div className="space-y-3">
            <h1 className="font-display text-2xl font-black text-cream">{s.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 font-bold text-gold">{s.seasons} season{s.seasons > 1 ? 's' : ''}</span>
              <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-dim">{s.episodes} episodes</span>
              {s.group && <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-dim">{s.group}</span>}
              {s.imdbId && <a href={`https://www.imdb.com/title/${s.imdbId}/`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line bg-surface px-2 py-0.5 text-dim hover:text-gold">IMDb</a>}
            </div>
            {s.plot && <p className="text-sm leading-relaxed text-dim">{s.plot}</p>}
            <div className="flex flex-wrap gap-2">
              <Link href="/iptv/player" className="btn-gold"><Play size={15} /> Browser par dekhein</Link>
              <Link href="/iptv/start" className="btn-ghost">Free trial <ArrowRight size={14} /></Link>
            </div>
          </div>
        </div>

        <section className="mt-7 space-y-3">
          <h2 className="font-display text-base font-bold text-cream">Episodes</h2>
          {s.seasonList.map((season) => (
            <div key={season.n} className="rounded-2xl border border-line bg-surface p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gold"><Star size={11} /> Season {season.n} · {season.episodes.length} episodes</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {season.episodes.map((e) => (
                  <li key={e.n} className="flex items-center gap-2 rounded-lg border border-line bg-raised px-2 py-1 text-[11px] text-dim">
                    <span className="w-7 shrink-0 font-mono text-faint">E{e.n}</span>
                    <span className="truncate">{e.title || `Episode ${e.n}`}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {!!related.length && (
          <section className="mt-8">
            <h2 className="mb-2 font-display text-base font-bold text-cream">Isi category se</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {related.map((x) => (
                <Link key={x.id} href={`/iptv/series/${x.id}`} className="overflow-hidden rounded-xl border border-line bg-surface hover:border-gold/40">
                  {x.poster ? <img src={x.poster} alt={x.name} loading="lazy" className="aspect-[2/3] w-full object-cover" /> : <div className="grid aspect-[2/3] place-items-center text-faint"><Tv size={20} /></div>}
                  <p className="truncate p-2 text-[11px] font-semibold text-cream">{x.name}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
