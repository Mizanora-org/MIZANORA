import { Suspense } from 'react';
import Link from 'next/link';
import { pageMeta } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import ProductAds from '@/components/ProductAds';
import LiveTvPlayer from '@/components/LiveTvPlayer';
import LiveStrip from '@/components/LiveStrip';
import { getTvAds, getTvConfig } from '@/lib/liveTvServer';
import { getChannelConfig } from '@/lib/liveChannelServer';
import { channelGroups, channelSlugs } from '@/lib/liveTv';

export const revalidate = 600;
export const metadata = {
  ...pageMeta({ title: 'Live TV: Watch Channels Online Free', description: 'Mizanora Live TV: watch live channels online, switch with Next, Previous or Random, search by name, save favourites, choose stream quality, and find products while you watch. News, Islamic, Pakistan and more.', path: '/live' }),
  keywords: ['live tv', 'live tv pakistan', 'watch live tv online', 'pakistani live tv channels', 'islamic live tv', 'live news channels', 'mizanora live tv'],
};

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
      <PageHead title={cfg.title} intro={on ? (cfg.note || 'Channel badalne ke liye Pichla / Agla dabayein, ya guide mein se chunein.') : 'Live TV abhi available nahi hai.'} crumbs={[['/', 'Home'], [null, 'Live TV']]} />
      <div className="mx-auto max-w-7xl px-3 pt-3 sm:px-4">
        <LiveStrip
          channel={chCfg}
          initialAt={Date.now()}
          tv={{ count: list.length, channels: list.map((x) => ({ name: x.c.name, slug: x.s, off: x.c.off, group: x.c.group })) }}
          variant="page"
        />
      </div>
      <section className="mx-auto max-w-7xl px-3 py-6 sm:px-4">
        {on ? <LiveTvPlayer cfg={cfg} ads={ads} /> : <p className="rounded-2xl bg-raised p-5 text-dim">Live TV jaldi shuru hoga. Tab tak <Link className="font-bold text-gold underline" href="/quran">Quran</Link> aur <Link className="font-bold text-gold underline" href="/hadith">Hadees</Link> padhein.</p>}
      </section>
      {on && (
        <section className="mx-auto max-w-7xl px-4 pb-4" aria-label="All channels">
          <h2 className="section-title">All live TV channels</h2>
          <p className="mt-1 text-sm text-dim">{list.length} channels{groups.length ? `: ${groups.map((g) => `${g.name} (${g.count})`).join(', ')}` : ''}. The player guide has the full searchable list.</p>
          {/* A compact SEO list: the heavy, interactive list is inside the player and streams separately. */}
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">{list.slice(0, 120).map((x) => <li key={x.s}><Link href={`/live/${x.s}`} prefetch={false} className="inline-block rounded-full border border-line bg-surface px-3 py-1 hover:border-gold hover:text-gold">{x.c.name}</Link></li>)}</ul>
        </section>
      )}
      <section className="mx-auto max-w-3xl px-4 pb-4 text-sm text-dim"><p>Mizanora Live TV shows only the channels the shop owner has added. Streams belong to their owners. If a channel does not play, press Retry or Next, or switch on auto-skip. More free <Link className="font-bold text-gold underline" href="/tools">online tools</Link> and <Link className="font-bold text-gold underline" href="/blog">guides</Link> are on Mizanora.</p></section>
      {/* Product photos no longer hold up the player: this strip streams in afterwards. */}
      <Suspense fallback={null}><ProductAds seed="live-tv" title="Shop while you watch" /></Suspense>
    </>
  );
}
