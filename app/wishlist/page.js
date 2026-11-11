import { pageMeta } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import WishlistClient from '@/components/WishlistClient';
// v61: wishlist cards come from the catalogue — value from lib/cachePolicy.js (ISR write budget; see the comment there).
export const revalidate = 86400; // 1 day — ISR write budget, see lib/cachePolicy.js

export const metadata = pageMeta({ title: 'My wishlist', description: 'Products you saved on Mizanora.', path: '/wishlist', noindex: true });

export default async function WishlistPage() {
  return (
    <>
      <PageHead title="My wishlist" intro="Saved on this phone, and on your account when you are signed in. Tap the heart on a product to add or remove it." crumbs={[['/', 'Home'], [null, 'Wishlist']]} />
      <div className="mx-auto max-w-7xl px-3 py-8 sm:px-4"><WishlistClient /></div>
    </>
  );
}
