import { Suspense } from 'react';
import Link from 'next/link';
import { Radio, Sparkles, MonitorPlay, AudioLines, Camera } from 'lucide-react';
import { pageMeta } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import ProductAds from '@/components/ProductAds';
import LiveTvPlayer from '@/components/LiveTvPlayer';
import LiveStrip from '@/components/LiveStrip';
import LiveBadge from '@/components/LiveBadge';
import { getTvAds, getTvConfig } from '@/lib/liveTvServer';
import { getChannelConfig } from '@/lib/liveChannelServer';
import { channelGroups, channelSlugs } from '@/lib/liveTv';
import { channelHue, channelInitials } from '@/lib/liveTvUi';
// v61: the Live TV directory changes when the admin edits channels — value from lib/cachePolicy.js (ISR write budget; see the comment there).
export const revalidate = 86400; // 1 day — ISR write budget, see lib/cachePolicy.js

export const metadata = {
  ...pageMeta({ title: 'Live TV: Watch Channels Online Free', description: 'Mizanora Live TV: watch live channels online on a fast custom player. Beautiful channel grid, search, favourites, exact video quality (1080p/720p), audio tracks, captions, photo capture, Next / Previous / Random. News, Islamic, Pakistan and more.', path: '/live' }),
  keywords: ['live tv', 'live tv pakistan', 'watch live tv online', 'pakistani live tv channels', 'islamic live tv', 'live news channels', 'mizanora live tv'],
};

const logoHttps = (u) => { const v = String(u || ''); return /^http:\/\//i.test(v) ? v.replace(/^http:/i, 'https:') : v; };

export default async function LivePage() {
  const cfg = await getTvConfig();
  // v33: the Quran & Hadith channel bar - what MIZANORA itself is broadcasting right now
  // (it runs even when Live TV has no channels, so this page is never "empty").
  const chCfg = await getChannelConfig().catch(() => null);
  const on = cfg.enabled && cfg.channels.some((c) => !c.off);
  const ads = on && cfg.ads.enabled ? await getTvAds(cfg.ads.slugs) : [];
  const slugs = channelSlugs(cfg.channels);
  const list = cfg.channels.map((c, i) => ({ c, s: slugs[i] })).filter((x) => !x.c.off);
  const groups = channelGroups(cfg.channels, 12);
  const ld = on ? { '@context': 'https://schema.org', '@type': 'ItemList', name: cfg.title, itemListElement: list.slice(0, 200).map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.c.name, url: absUrl(`/live/${x.s}`) })) } : null;
  return (
    <>
      {ld && <JsonLd data={ld} />}
      <PageHead title={cfg.title} intro={on ? (cfg.note || 'Channel badalne ke liye Pichla / Agla dabayein, ya grid mein se chunein.') : 'Live TV abhi available nahi hai.'} crumbs={[['/', 'Home'], [null, 'Live TV']]} />
      <div className="mx-auto max-w-7xl px-3 pt-3 sm:px-4">
        <LiveStrip
          channel={chCfg}
          initialAt={Date.now()}
          tv={{ count: list.length, channels: list.map((x) => ({ name: x.c.name, slug: x.s, off: x.c.off, group: x.c.group })) }}
          variant="page"
        />
      </div>
      {on && (
        <div className="mx-auto max-w-7xl px-3 pt-3 sm:px-4">
          {/* v49 hero: what the new player does, said in one glance (the player below proves it). */}
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#052e1d] via-[#0B6B45] to-[#08301f] p-5 text-white shadow-[0_24px_50px_-24px_rgba(6,48,31,.8)] sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <LiveBadge state="live" label="NAYA PLAYER" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[.68rem] font-extrabold tracking-wide"><Radio size={12} /> {list.length.toLocaleString('en-PK')} LIVE CHANNELS</span>
              {groups.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[.68rem] font-extrabold tracking-wide"><Sparkles size={12} /> {groups.length} GROUPS</span>}
            </div>
            <h2 className="mt-3 font-display text-2xl font-extrabold leading-tight sm:text-3xl">Khoobsurat grid, tez tareen player — <span className="text-[#F2C766]"> bilkul naye andaaz mein</span></h2>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[.82rem] font-semibold text-white/85">
              <li className="inline-flex items-center gap-1.5"><MonitorPlay size={14} className="text-[#F2C766]" /> Asal resolution chunein: 1080p, 720p, 480p</li>
              <li className="inline-flex items-center gap-1.5"><AudioLines size={14} className="text-[#F2C766]" /> Audio track + captions jis channel mein hon</li>
              <li className="inline-flex items-center gap-1.5"><Camera size={14} className="text-[#F2C766]" /> Ek tap par picture capture</li>
            </ul>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">Player ke neeche tamam channels rangon wale cards mein hain — search karein, group chunein, pasandeeda save karein. Settings (gear) mein quality, awaaz aur captions ka poora control hai.</p>
          </div>
        </div>
      )}
      <section className="mx-auto max-w-7xl px-3 py-6 sm:px-4">
        {on ? <LiveTvPlayer cfg={cfg} ads={ads} /> : <p className="rounded-2xl bg-raised p-5 text-dim">Live TV jaldi shuru hoga. Tab tak <Link className="font-bold text-gold underline" href="/quran">Quran</Link> aur <Link className="font-bold text-gold underline" href="/hadith">Hadees</Link> padhein.</p>}
      </section>
      {on && (
        <section className="mx-auto max-w-7xl px-4 pb-4" aria-label="All channels">
          <h2 className="section-title">Tamam Live TV Channels</h2>
          <p className="mt-1 text-sm text-dim">{list.length} channels{groups.length ? `: ${groups.map((g) => `${g.name} (${g.count})`).join(', ')}` : ''}. Kisi bhi card ko tap karein — channel apne page par khul jayega.</p>
          {/* A clean, crawlable logo grid (every channel keeps its own /live/<slug> page). */}
          <ul className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {list.slice(0, 120).map((x) => (
              <li key={x.s}>
                <Link href={`/live/${x.s}`} prefetch={false} className="group flex h-full flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-center transition hover:-translate-y-0.5 hover:border-gold hover:shadow-lg">
                  {x.c.logo
                    ? <img src={logoHttps(x.c.logo)} alt="" width={56} height={56} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-14 w-14 rounded-xl bg-white object-contain p-1" />
                    : <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-xl text-base font-extrabold text-white" style={{ background: `linear-gradient(145deg, hsl(${channelHue(x.c.name)},60%,34%), hsl(${(channelHue(x.c.name) + 45) % 360},65%,18%))` }}>{channelInitials(x.c.name)}</span>}
                  <span className="line-clamp-2 text-[.72rem] font-bold leading-tight text-cream group-hover:text-gold">{x.c.name}</span>
                  {x.c.group && <span className="text-[.6rem] font-semibold uppercase tracking-wide text-faint">{x.c.group}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mx-auto max-w-3xl px-4 pb-4 text-sm text-dim">
        <p>Mizanora Live TV shows only the channels the shop owner has added. Streams belong to their owners. If a channel does not play, press Retry or Next, or switch on auto-skip. Naya player, quality/awaaz ki settings aur channel load ke masail — teeno par tafseeli guides: <Link className="font-bold text-gold underline" href="/blog/mizanora-live-tv-v49-naya-player-beautiful-grid">Naya Live TV player</Link>, <Link className="font-bold text-gold underline" href="/blog/live-tv-video-quality-audio-track-capture-guide">Quality, audio track aur capture guide</Link> aur <Link className="font-bold text-gold underline" href="/blog/live-tv-channels-load-problem-fix-guide">Channels load nahi ho rahe? Fix guide</Link>. More free <Link className="font-bold text-gold underline" href="/tools">online tools</Link> and <Link className="font-bold text-gold underline" href="/blog">guides</Link> are on Mizanora.</p>
      </section>
      {/* Product photos no longer hold up the player: this strip streams in afterwards. */}
      <Suspense fallback={null}><ProductAds seed="live-tv" title="Shop while you watch" /></Suspense>
    </>
  );
}
