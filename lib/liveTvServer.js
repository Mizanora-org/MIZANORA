import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from './firebase-admin';
import { quotaTripped } from './quota';
import { getProduct } from './products';
import { TV_DEFAULT, TV_DEMO, TV_DOC, cleanTv } from './liveTv';

// Server side of Live TV: the admin's setting (Firestore siteMeta/liveTv, cached, tag "livetv", cleared when the admin saves) and the
// products chosen for the ads (name, photo, price read from the shop, so an ad can never show a wrong price).
const OFF = { ...TV_DEFAULT, enabled: false };
const DEMO_ON = process.env.MZ_TV_DEMO === '1';
const demoConfig = () => ({ ...cleanTv(TV_DEMO), demo: true });
const readConfig = unstable_cache(async () => {
  try {
    if (!adminReady() || quotaTripped()) return DEMO_ON ? demoConfig() : OFF;
    const d = await adminDb().collection(TV_DOC.collection).doc(TV_DOC.id).get();
    if (d.exists) return cleanTv({ ...TV_DEFAULT, ...d.data() });
    return DEMO_ON ? demoConfig() : OFF;
  } catch (e) { console.error('live tv config read failed:', e.message); return DEMO_ON ? demoConfig() : OFF; }
// v28: the key includes the demo mode so a build without the flag cannot serve a cached empty config, and vice versa.
}, [`mz-livetv-config-v2-${DEMO_ON ? 'demo' : 'live'}`], { revalidate: 600, tags: ['livetv'] });
export const getTvConfig = () => readConfig();

// One Firestore read per ad product, all at once. The old sequential loop could add 30 round trips
// to the first paint of /live and every channel page.
export async function getTvAds(slugs) {
  const unique = [...new Set((slugs || []).slice(0, 30))];
  const rows = await Promise.all(unique.map(async (slug) => {
    try {
      const p = await getProduct(slug);
      if (!p || p.inStock === false || !p.name) return null;
      return {
        slug: p.slug,
        name: p.name.slice(0, 90),
        image: (p.images && p.images[0]) || '',
        price: p.price,
        comparePrice: p.comparePrice > p.price ? p.comparePrice : 0,
      };
    } catch (_) { /* a product that cannot be read is simply not advertised */ return null; }
  }));
  return rows.filter(Boolean);
}
