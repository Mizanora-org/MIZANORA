import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import JsonLd from '@/components/JsonLd';
import { PageHead } from '@/components/Prose';
import IptvPlayer from '@/components/IptvPlayer';

export const metadata = pageMeta({
  title: 'Mizanora Player — apni IPTV line se live TV, movies aur series',
  description:
    'Apna Mizanora IPTV username aur password daalein aur browser mein live channels, movies aur series chalayein. EPG guide, ads aur full HD — koi app install nahi.',
  path: '/iptv/player',
});

export default function PlayerPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([['/', 'Home'], ['/iptv', 'IPTV'], ['/iptv/player', 'Player']])} />
      <PageHead
        title="Mizanora Player"
        intro="Apni line ke username/password se live TV, movies aur series — browser mein hi. Xtream apps (TiviMate, Smarters) mein bhi yahi login chalta hai."
      />
      <div className="mx-auto max-w-6xl px-4 pb-12">
        <IptvPlayer />
      </div>
    </>
  );
}
