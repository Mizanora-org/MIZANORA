import Link from 'next/link';
import { ArrowRight, Film } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import JsonLd from '@/components/JsonLd';
import { PageHead } from '@/components/Prose';
import IptvLibrary from '@/components/IptvLibrary';
import { getPublicLibrary } from '@/lib/iptvPublic';

export const revalidate = 300;

export const metadata = pageMeta({
  title: 'Movies library — Mizanora IPTV par naye aur best movies (IMDb ratings)',
  description:
    'Mizanora IPTV ki movies library: poster, IMDb rating, saal aur category ke sath. Xtream apps ya browser player par chalayein — Rs 200/mahina, 24 ghante free trial.',
  path: '/iptv/movies',
});

export default async function MoviesPage() {
  const lib = await getPublicLibrary();
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([['/', 'Home'], ['/iptv', 'IPTV'], ['/iptv/movies', 'Movies']])} />
      <PageHead
        title="Movies library"
        intro={lib.movies.length
          ? `${lib.movies.length.toLocaleString('en-PK')} movies — IMDb rating, poster aur category ke sath. Pasand aaye to line lein aur Xtream apps ya browser player par dekhein.`
          : 'Movies library abhi bharti ja rahi hai. Admin IPTV panel se M3U import hoti hai aur IMDb detail khud bhar jati hai.'}
      />
      <div className="mx-auto max-w-6xl px-4 pb-12">
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href="/iptv/player" className="btn-gold"><Film size={15} /> Browser player</Link>
          <Link href="/iptv/start" className="btn-ghost">Free trial <ArrowRight size={14} /></Link>
          <Link href="/iptv" className="btn-ghost">Plans &amp; pricing</Link>
        </div>
        <IptvLibrary kind="movies" items={lib.movies} groups={lib.groups.movies}
          emptyNote="Abhi movies library khali hai — admin panel se M3U import karein, phir yahan poster grid khud ban jayega." />
      </div>
    </>
  );
}
