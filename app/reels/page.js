import { getReels } from '@/lib/products';
import { getReelMusic } from '@/lib/reelMusicServer';
import { pageMeta } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import ReelsRail from '@/components/ReelsRail';
import LiveBadge from '@/components/LiveBadge';
import Link from 'next/link';

export const revalidate = 1800; // data comes from the shared cache; the admin panel refreshes pages instantly
export const metadata = pageMeta({ title: 'Reels: Watch and Shop', description: 'Watch short videos of Mizanora products and shop them with one tap. Cash on delivery across Pakistan.', path: '/reels' });

export default async function ReelsPage() {
  const [reels, music] = await Promise.all([getReels(), getReelMusic()]);
  return (
    <>
      <PageHead title="Reels: watch and shop" intro="Short videos of real products, in a fresh random order every time you open this page. Open a reel, swipe up for the next one, and tap Shop now on anything you like." crumbs={[['/', 'Home'], [null, 'Reels']]} />
      <div className="mx-auto max-w-7xl px-3 py-8 sm:px-4">
        {reels.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <LiveBadge state="live" label="REELS" />
            <LiveBadge state="fresh" label={`${reels.length} videos`} pulse={false} />
            <LiveBadge state="soon" label="Naya order har visit" pulse={false} />
            <span className="text-xs text-dim">Swipe up for the next reel, tap <b>Shop now</b> to buy what you see.</span>
          </div>
        )}
        {reels.length ? <ReelsRail reels={reels} grid shuffle autoOpen music={music} /> : (
          <div className="card text-center"><p className="text-dim">Reels are coming soon.</p><Link href="/products" className="btn-gold mt-4">Browse products</Link></div>
        )}
      </div>
    </>
  );
}
