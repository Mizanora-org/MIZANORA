import Link from 'next/link';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import JsonLd from '@/components/JsonLd';
import { PageHead } from '@/components/Prose';
import IptvGuideGrid from '@/components/IptvGuideGrid';
import { getGatewayCatalogue } from '@/lib/gateway/catalogue';
import { getEpg, guideForChannels } from '@/lib/gateway/epg';
import { nowNext } from '@/lib/iptvEpg';
import { archiveDaysFor } from '@/lib/iptvCatchup';

export const revalidate = 300;

export const metadata = pageMeta({
  title: 'TV guide (EPG) — Mizanora IPTV channels ka programme schedule',
  description:
    'Mizanora IPTV ka TV guide: har channel par abhi kya chal raha hai aur aage kya aayega. Xtream apps mein poora 7-din EPG, browser player mein now/next.',
  path: '/iptv/guide',
});

export default async function GuidePage() {
  let rows = [];
  let counts = { real: 0, generated: 0 };
  try {
    const cat = await getGatewayCatalogue();
    const epg = await getEpg().catch(() => ({ map: {}, guide: { channels: [], programmes: [] } }));
    const guide = guideForChannels(cat.channels.slice(0, 400), epg);
    counts = { real: guide.real, generated: guide.generated };
    const now = Date.now();
    rows = cat.channels.slice(0, 400).map((c, i) => {
      const epgId = (guide.channels[i] || {}).id || `mz-${c.id}.tv`;
      const nn = nowNext({ programmes: guide.programmes }, epgId, now);
      const upcoming = guide.programmes
        .filter((p) => p.channel === epgId && p.start > now)
        .slice(0, 4)
        .map((p) => ({ title: p.title, start: p.start, stop: p.stop }));
      return { id: c.id, name: c.name, group: c.group, logo: c.logo || '', archive: archiveDaysFor(c), now: nn.now?.title || '', nowStop: nn.now?.stop || 0, items: upcoming };
    });
  } catch { /* empty guide */ }

  const groups = [...rows.reduce((m, r) => m.set(r.group, (m.get(r.group) || 0) + 1), new Map()).entries()]
    .map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([['/', 'Home'], ['/iptv', 'IPTV'], ['/iptv/guide', 'TV guide']])} />
      <PageHead
        title="TV guide"
        intro={rows.length
          ? `${rows.length} channels ka schedule — asli programmes ${counts.real.toLocaleString('en-PK')}, baqi channels par auto slots. Apps mein poora EPG XML milta hai.`
          : 'Guide abhi khali hai — channels import hone ke baad yahan schedule aa jayega.'}
      />
      <div className="mx-auto max-w-6xl px-4 pb-12">
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href="/iptv/channels" className="btn-ghost"><CalendarClock size={15} /> Channel list</Link>
          <Link href="/iptv/player" className="btn-gold">Browser player <ArrowRight size={14} /></Link>
          <Link href="/iptv/start" className="btn-ghost">Free trial</Link>
        </div>
        <IptvGuideGrid rows={rows} groups={groups} />
        <section className="card mt-3">
          <h2 className="font-display text-sm font-bold text-cream">7-din catch-up</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-dim">
            Jin channels par <span className="rounded bg-gold/15 px-1 font-bold text-gold">7d</span> badge hai, wahan pichhle 7 din ke programmes dobara chal sakte hain —
            path: <code className="text-cream">/timeshift/&lt;user&gt;/&lt;pass&gt;/&lt;minutes&gt;/&lt;YYYY-MM-DD:HH-MM&gt;/&lt;channel&gt;.ts</code>.
            Xtream apps mein yeh catch-up icon se khulta hai; archive link har waqt sealed rehta hai.
          </p>
        </section>
      </div>
    </>
  );
}
