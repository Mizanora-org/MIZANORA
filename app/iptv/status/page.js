import Link from 'next/link';
import { Activity, Clapperboard, Film, Radio, RefreshCw, Tv } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import JsonLd from '@/components/JsonLd';
import { PageHead } from '@/components/Prose';
import { getPublicStats } from '@/lib/iptvPublic';
import { readEpgDoc } from '@/lib/gateway/epg';

export const revalidate = 120;

export const metadata = pageMeta({
  title: 'IPTV status — channels, movies, series aur EPG ka live hisab',
  description: 'Mizanora IPTV ka public status: kitne channels, movies, series aur EPG sources live hain, aur data kab update hua.',
  path: '/iptv/status',
});

export default async function StatusPage() {
  const s = await getPublicStats();
  const epg = await readEpgDoc().catch(() => ({ sources: [] }));
  const when = s.updatedAt ? new Date(s.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  const cards = [
    [Radio, s.channels, 'Live channels', `${s.groups} groups`],
    [Film, s.movies, 'Movies', 'IMDb detail ke sath'],
    [Clapperboard, s.series, 'Series', `${s.episodes} episodes`],
    [Tv, epg.sources.length, 'EPG sources', epg.sources.length ? 'XMLTV connected' : 'auto slots'],
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([['/', 'Home'], ['/iptv', 'IPTV'], ['/iptv/status', 'Status']])} />
      <PageHead
        title="System status"
        intro={s.ready ? `Gateway chal raha hai — aakhri update ${when}.` : 'Abhi catalogue bhar raha hai — thodi der baad dobara dekhein.'}
      />
      <div className="mx-auto max-w-5xl px-4 pb-12">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(([Icon, v, l, note]) => (
            <div key={l} className="card">
              <Icon size={16} className="text-gold" />
              <p className="mt-2 font-display text-2xl font-black text-cream">{Number(v || 0).toLocaleString('en-PK')}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-faint">{l}</p>
              <p className="text-[11px] text-dim">{note}</p>
            </div>
          ))}
        </div>

        <section className="card mt-4">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-cream"><Activity size={15} className="text-gold" /> Kaise chalta hai</h2>
          <ul className="mt-2 space-y-1 text-[11px] text-dim">
            <li>• Xtream: <code>/player_api.php</code> · <code>/get.php</code> · <code>/xmltv.php</code></li>
            <li>• Stalker (MAG): <code>/c/</code> · <code>/portal.php</code></li>
            <li>• Stream: <code>/live|/movie|/series/&lt;user&gt;/&lt;pass&gt;/&lt;id&gt;</code> — links sealed hote hain (v1. token)</li>
            <li>• Browser player: <Link href="/iptv/player" className="text-gold underline">/iptv/player</Link> · Guide: <Link href="/iptv/guide" className="text-gold underline">/iptv/guide</Link></li>
          </ul>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-faint"><RefreshCw size={11} /> Yeh page har 2 minute mein khud refresh hota hai.</p>
        </section>

        <section className="card mt-4">
          <h2 className="font-display text-base font-bold text-cream">Problem ho to</h2>
          <ol className="mt-2 space-y-1 text-[11px] text-dim">
            <li>1. Apna internet check karein — IPTV ke liye 5 Mbps kaafi hai.</li>
            <li>2. App band kar ke dobara kholein (playlist refresh).</li>
            <li>3. Username/password dobara daalein — reseller se reset karwayein.</li>
            <li>4. Phir bhi na chale to reseller ko WhatsApp karein (line number ke sath).</li>
          </ol>
        </section>
      </div>
    </>
  );
}
