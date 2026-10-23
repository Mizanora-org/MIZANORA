import { pageMeta } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import LiveTvPlayer from '@/components/LiveTvPlayer';
import { getTvAds, getTvConfig } from '@/lib/liveTvServer';

export const revalidate = 600;
export const metadata = pageMeta({ title: 'Live TV', description: 'Mizanora Live TV: watch channels, switch with Next and Previous, and discover products while you browse.', path: '/live' });

export default async function LivePage() {
  const cfg = await getTvConfig();
  const on = cfg.enabled && cfg.channels.some((c) => !c.off);
  const ads = on && cfg.ads.enabled ? await getTvAds(cfg.ads.slugs) : [];
  return (
    <>
      <PageHead title={cfg.title} intro={on ? (cfg.note || 'Channel badalne ke liye Pichla / Agla dabayein.') : 'Live TV abhi available nahi hai.'} crumbs={[['/', 'Home'], [null, 'Live TV']]} />
      <section className="mx-auto max-w-3xl px-4 py-6">
        {on ? <LiveTvPlayer cfg={cfg} ads={ads} /> : <p className="rounded-2xl bg-raised p-5 text-dim">Live TV jaldi shuru hoga. Tab tak <a className="font-bold text-gold underline" href="/quran">Quran</a> aur <a className="font-bold text-gold underline" href="/hadith">Hadees</a> padhein.</p>}
      </section>
    </>
  );
}
