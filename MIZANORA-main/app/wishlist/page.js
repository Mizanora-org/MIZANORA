import { pageMeta } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import WishlistClient from '@/components/WishlistClient';

export const revalidate = 1800; // data comes from the shared cache; the admin panel refreshes pages instantly
export const metadata = pageMeta({ title: 'My wishlist', description: 'Products you saved on Mizanora.', path: '/wishlist', noindex: true });

export default async function WishlistPage() {
  return (
    <>
      <PageHead title="My wishlist" intro="Saved on this phone, and on your account when you are signed in. Tap the heart on a product to add or remove it." crumbs={[['/', 'Home'], [null, 'Wishlist']]} />
      <div className="mx-auto max-w-7xl px-3 py-8 sm:px-4"><WishlistClient /></div>
    </>
  );
}
