import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pageMeta } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import ProductAds from '@/components/ProductAds';
import LiveTvPlayer from '@/components/LiveTvPlayer';
import LiveBadge from '@/components/LiveBadge';
import { getTvAds, getTvConfig } from '@/lib/liveTvServer';
import { channelSlugs } from '@/lib/liveTv';

// One address per channel (/live/<channel-name>): it opens the Live TV player on that channel and gives Google a page to find.
// Saved channels are prerendered at build time; a channel added later is generated on first request and then cached.
export const revalidate = 600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const cfg = await getTvConfig().catch(() => null);
  if (!cfg || !cfg.enabled) return [];
  const slugs = channelSlugs(cfg.channels);
  return cfg.channels.map((c, i) => (c.off ? null : { slug: slugs[i] })).filter(Boolean).slice(0, 200);
}

async function find(slug) {
  const cfg = await getTvConfig();
  if (!cfg.enabled) return { cfg, i: -1 };
  const i = channelSlugs(cfg.channels).indexOf(slug);
  return { cfg, i: i >= 0 && !cfg.channels[i].off ? i : -1 };
}
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { cfg, i } = await find(slug);
  if (i < 0) return { robots: { index: false, follow: false } };
  const c = cfg.channels[i];
  return { ...pageMeta({ title: `${c.name} Live TV: Watch Online`, description: `Watch ${c.name} live on Mizanora Live TV${c.group ? ` (${c.group})` : ''}. Switch channels with Next and Previous, search all channels, choose stream quality and save favourites.`, path: `/live/${slug}`, image: c.logo || '/img/hero-banner.jpg' }), keywords: [`${c.name} live`, `${c.name} live tv`, `watch ${c.name} online`, `${c.name} live streaming`, 'live tv online'] };
}

export default async function ChannelPage({ params }) {
  const { slug } = await params;
  const { cfg, i } = await find(slug);
  if (i < 0) notFound();
  const c = cfg.channels[i];
  const ads = cfg.ads.enabled ? await getTvAds(cfg.ads.slugs) : [];
  const ld = { '@context': 'https://schema.org', '@type': 'BroadcastService', name: c.name, url: absUrl(`/live/${slug}`), ...(c.logo ? { logo: c.logo } : {}), broadcastDisplayName: c.name, provider: { '@id': absUrl('/#org') } };
  return (
    <>
      <JsonLd data={ld} />
      <PageHead title={`${c.name} Live`} intro={`Watch ${c.name} live${c.group ? ` · ${c.group}` : ''}. Use Next and Previous to change channel.`} crumbs={[['/', 'Home'], ['/live', 'Live TV'], [null, c.name]]} />
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 pt-4 sm:px-4">
        <LiveBadge state="live" label="ON AIR" />
        <LiveBadge state="soon" label={c.group || 'Live TV'} pulse={false} />
        <span className="text-xs text-dim">Pakistan time · quality aur audio apni pasand se chunein</span>
      </div>
      <section className="mx-auto max-w-7xl px-3 py-6 sm:px-4"><LiveTvPlayer cfg={cfg} ads={ads} initialSlug={slug} /></section>
      <p className="mx-auto max-w-3xl px-4 text-sm text-dim">All channels are on the <Link className="font-bold text-gold underline" href="/live">Live TV page</Link>.</p>
      <Suspense fallback={null}><ProductAds seed={`tv-${slug}`} title="Shop while you watch" /></Suspense>
    </>
  );
}
