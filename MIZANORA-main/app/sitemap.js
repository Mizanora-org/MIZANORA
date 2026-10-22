import { absUrl } from '@/lib/config';
import { getCategories, getProducts } from '@/lib/products';
import { allCards } from '@/lib/catalogQuery';
import { getPosts } from '@/lib/blog';
import { SURAHS, slugOfSurah } from '@/lib/quran';

export const revalidate = 3600;

export default async function sitemap() {
  const products = (await getProducts()).filter((p) => (p.images || [])[0]); // pages without a photo are not advertised
  const cats = await getCategories();
  let archived = [];
  try { archived = (await allCards()).archived; } catch { /* no archive */ }
  const posts = getPosts();
  const now = new Date();
  const fixed = [
    ['/', 1.0, 'daily'], ['/products', 0.9, 'daily'], ['/how-to-order', 0.7, 'monthly'], ['/blog', 0.8, 'weekly'], ['/workers', 0.8, 'monthly'], ['/reels', 0.6, 'weekly'], ['/track', 0.4, 'monthly'],
    ['/about', 0.5, 'monthly'], ['/team', 0.7, 'weekly'], ['/contact', 0.5, 'monthly'], ['/faq', 0.6, 'monthly'], ['/connect', 0.4, 'monthly'],
    ['/returns', 0.3, 'yearly'], ['/shipping', 0.5, 'monthly'], ['/size-guide', 0.5, 'monthly'], ['/islamic', 0.6, 'weekly'], ['/deals', 0.9, 'daily'], ['/quran', 0.7, 'monthly'], ['/muaaz-iqbal', 0.8, 'monthly'], ['/winter', 0.7, 'weekly'], ['/privacy-policy', 0.3, 'yearly'], ['/terms', 0.3, 'yearly'],
  ].map(([p, priority, changeFrequency]) => ({ url: absUrl(p), lastModified: now, changeFrequency, priority }));
  return [
    ...fixed,
    ...SURAHS.map((x) => ({ url: absUrl(`/quran/${slugOfSurah(x.n)}`), lastModified: now, changeFrequency: 'yearly', priority: 0.5 })),
    ...cats.map((c) => ({ url: absUrl(`/category/${c.slug}`), lastModified: now, changeFrequency: 'weekly', priority: 0.8 })),
    ...products.map((p) => ({ url: absUrl(`/product/${p.slug}`), lastModified: new Date(p.updatedAt || p.createdAt || now), changeFrequency: 'weekly', priority: 0.9, images: (p.images || []).slice(0, 3) })),
    // archived products (a sitemap file may hold 50,000 addresses in total)
    ...archived.slice(0, Math.max(0, 49000 - products.length - cats.length)).map((c) => ({ url: absUrl(`/product/${c.slug}`), lastModified: new Date(c.createdAt || now), changeFrequency: 'monthly', priority: 0.6 })),
    ...posts.map((p) => ({ url: absUrl(`/blog/${p.slug}`), lastModified: new Date(p.date), changeFrequency: 'monthly', priority: 0.7 })),
  ];
}
