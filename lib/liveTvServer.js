import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from './firebase-admin';
import { quotaTripped } from './quota';
import { getProduct } from './products';
import { TV_DEFAULT, TV_DOC, cleanTv } from './liveTv';

// Server side of Live TV: the admin's setting (Firestore siteMeta/liveTv, cached, tag "livetv", cleared when the admin saves) and the
// products chosen for the ads (name, photo, price read from the shop, so an ad can never show a wrong price).
const OFF = { ...TV_DEFAULT, enabled: false };
const readConfig = unstable_cache(async () => {
  try {
    if (!adminReady() || quotaTripped()) return OFF;
    const d = await adminDb().collection(TV_DOC.collection).doc(TV_DOC.id).get();
    return d.exists ? cleanTv({ ...TV_DEFAULT, ...d.data() }) : OFF;
  } catch (e) { console.error('live tv config read failed:', e.message); return OFF; }
}, ['mz-livetv-config-v1'], { revalidate: 600, tags: ['livetv'] });
export const getTvConfig = () => readConfig();

export async function getTvAds(slugs) {
  const out = [];
  for (const s of (slugs || []).slice(0, 30)) {
    try {
      const p = await getProduct(s);
      if (p && p.inStock !== false && p.name) out.push({ slug: p.slug, name: p.name.slice(0, 90), image: (p.images && p.images[0]) || '', price: p.price, comparePrice: p.comparePrice > p.price ? p.comparePrice : 0 });
    } catch (e) { /* a product that cannot be read is simply not advertised */ }
  }
  return out;
}
