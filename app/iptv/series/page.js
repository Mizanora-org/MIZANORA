import Link from 'next/link';
import { ArrowRight, Tv } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import JsonLd from '@/components/JsonLd';
import { PageHead } from '@/components/Prose';
import IptvLibrary from '@/components/IptvLibrary';
import { getPublicLibrary } from '@/lib/iptvPublic';

export const revalidate = 300;

export const metadata = pageMeta({
  title: 'Series library — seasons aur episodes Mizanora IPTV par',
  description:
    'Mizanora IPTV ki series library: season, episode count, poster aur plot. Xtream apps ya browser player par poori series chalayein.',
  path: '/iptv/series',
});

export default async function SeriesPage() {
  const lib = await getPublicLibrary();
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([['/', 'Home'], ['/iptv', 'IPTV'], ['/iptv/series', 'Series']])} />
      <PageHead
        title="Series library"
        intro={lib.series.length
          ? `${lib.series.length.toLocaleString('en-PK')} series — season aur episodes ke sath. Apps mein "Series" tab mein bhi yahi list milti hai.`
          : 'Series library abhi bharti ja rahi hai. Naam mein S01E02 ho to import khud season/episode samajh leta hai.'}
      />
      <div className="mx-auto max-w-6xl px-4 pb-12">
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href="/iptv/player" className="btn-gold"><Tv size={15} /> Browser player</Link>
          <Link href="/iptv/movies" className="btn-ghost">Movies</Link>
          <Link href="/iptv/start" className="btn-ghost">Free trial <ArrowRight size={14} /></Link>
        </div>
        <IptvLibrary kind="series" items={lib.series} groups={lib.groups.series}
          emptyNote="Abhi series library khali hai — admin panel se M3U import karein (S01E02 wale naam khud pehchane jate hain)." />
      </div>
    </>
  );
}
