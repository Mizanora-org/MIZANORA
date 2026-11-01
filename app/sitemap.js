import { absUrl } from '@/lib/config';
import { getCategories, getProducts } from '@/lib/products';
import { allCards } from '@/lib/catalogQuery';
import { getPosts } from '@/lib/blog';
import { SURAHS, slugOfSurah } from '@/lib/quran';
import { TOOLS } from '@/lib/tools';
import { getTvConfig } from '@/lib/liveTvServer';
import { channelSlugs } from '@/lib/liveTv';
import { getMuaazImages } from '@/lib/imagesServer';
import { FOUNDER } from '@/lib/team';
import { founderPhotoUrls } from '@/lib/founderPhotos';

export const revalidate = 3600;

export default async function sitemap() {
  const products = (await getProducts()).filter((p) => (p.images || [])[0]); // pages without a photo are not advertised
  const cats = await getCategories();
  let archived = [];
  try { archived = (await allCards()).archived; } catch { /* no archive */ }
  const posts = getPosts();
  const now = new Date();
  // v36: Muaaz Iqbal's photos go into the image sitemap so Google Images / search can find them.
  // Self-hosted files come FIRST (they are on our own domain, so they are the ones worth indexing);
  // the old third-party links and any Admin > Images links follow.
  const muaazImgs = (await getMuaazImages().catch(() => [])).map((i) => i.url).filter(Boolean);
  const muaazPageImgs = [...founderPhotoUrls(absUrl('/')), ...FOUNDER.photos, ...muaazImgs].filter(Boolean).slice(0, 20);
  let tv = [];
  try { const cfg = await getTvConfig(); if (cfg.enabled) { const sl = channelSlugs(cfg.channels); tv = cfg.channels.map((c, i) => ({ c, s: sl[i] })).filter((x) => !x.c.off).slice(0, 800); } } catch { /* no TV */ }
  const fixed = [
    ['/', 1.0, 'daily'], ['/products', 0.9, 'daily'], ['/how-to-order', 0.7, 'monthly'], ['/blog', 0.8, 'weekly'], ['/workers', 0.8, 'monthly'], ['/reels', 0.6, 'weekly'], ['/track', 0.4, 'monthly'],
    ['/about', 0.5, 'monthly'], ['/team', 0.7, 'weekly'], ['/contact', 0.5, 'monthly'], ['/faq', 0.6, 'monthly'], ['/connect', 0.4, 'monthly'],
    // v37: the public live-stats page (updated every minute, so Google is told to come back often)
    ['/stats', 0.5, 'daily'],
    // v37: the news desk (world / science / technology dispatches) and its own RSS feed
    ['/news', 0.8, 'daily'],
    ['/returns', 0.3, 'yearly'], ['/shipping', 0.5, 'monthly'], ['/size-guide', 0.5, 'monthly'], ['/islamic', 0.6, 'weekly'], ['/deals', 0.9, 'daily'], ['/quran', 0.7, 'monthly'], ['/hadith', 0.7, 'monthly'], ['/live', 0.7, 'daily'], ['/tools', 0.9, 'weekly'], ['/reviews', 0.7, 'daily'], ['/muaaz-iqbal', 0.8, 'monthly'], ['/winter', 0.7, 'weekly'], ['/privacy-policy', 0.3, 'yearly'], ['/terms', 0.3, 'yearly'],
  ].map(([p, priority, changeFrequency]) => ({ url: absUrl(p), lastModified: now, changeFrequency, priority }));
  // v31: /muaaz-iqbal carries its images in the sitemap (Google Images / search)
  const fixedWithImgs = muaazPageImgs.length
    ? fixed.map((f) => (f.url === absUrl('/muaaz-iqbal') ? { ...f, images: muaazPageImgs } : f))
    : fixed;
  return [
    ...fixedWithImgs,
    ...SURAHS.map((x) => ({ url: absUrl(`/quran/${slugOfSurah(x.n)}`), lastModified: now, changeFrequency: 'yearly', priority: 0.5 })),
    ...cats.map((c) => ({ url: absUrl(`/category/${c.slug}`), lastModified: now, changeFrequency: 'weekly', priority: 0.8 })),
    ...products.map((p) => ({ url: absUrl(`/product/${p.slug}`), lastModified: new Date(p.updatedAt || p.createdAt || now), changeFrequency: 'weekly', priority: 0.9, images: (p.images || []).slice(0, 3) })),
    // archived products (a sitemap file may hold 50,000 addresses in total)
    ...archived.slice(0, Math.max(0, 49000 - products.length - cats.length)).map((c) => ({ url: absUrl(`/product/${c.slug}`), lastModified: new Date(c.createdAt || now), changeFrequency: 'monthly', priority: 0.6 })),
    ...TOOLS.map((t) => ({ url: absUrl(`/tools/${t.slug}`), lastModified: now, changeFrequency: 'monthly', priority: 0.8 })),
    ...tv.map((x) => ({ url: absUrl(`/live/${x.s}`), lastModified: now, changeFrequency: 'weekly', priority: 0.5 })),
    // v31: blog posts advertise their image (front matter "image: https://...")
    // v36: a sitemap must hold ABSOLUTE image addresses. A guide may name a local picture
    // (image: /img/muaaz/...), and that used to be written out as a bare path Google rejects.
    ...posts.map((p) => {
      const img = String(p.image || '').trim();
      const images = img ? [img.startsWith('http') ? img : absUrl(img)] : [];
      return { url: absUrl(`/blog/${p.slug}`), lastModified: new Date(p.date), changeFrequency: 'monthly', priority: 0.7, ...(images.length ? { images } : {}) };
    }),
  ];
}
