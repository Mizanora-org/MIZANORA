import { getProducts } from '@/lib/products';
import { pageMeta } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import WishlistClient from '@/components/WishlistClient';

export const revalidate = 1800; // data comes from the shared cache; the admin panel refreshes pages instantly
export const metadata = pageMeta({ title: 'My wishlist', description: 'Products you saved on Mizanora.', path: '/wishlist', noindex: true });

export default async function WishlistPage() {
  const all = await getProducts();
  // Only the fields a product card needs are sent to the browser.
  const products = all.map((p) => ({ id: p.id, slug: p.slug, name: p.name, price: p.price, comparePrice: p.comparePrice, images: p.images.slice(0, 1), sizes: p.sizes, inStock: p.inStock, category: p.category }));
  return (
    <>
      <PageHead title="My wishlist" intro="Saved on this phone. Tap the heart on a product to add or remove it." crumbs={[['/', 'Home'], [null, 'Wishlist']]} />
      <div className="mx-auto max-w-7xl px-3 py-8 sm:px-4"><WishlistClient products={products} /></div>
    </>
  );
}
