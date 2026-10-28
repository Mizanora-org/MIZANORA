// v31: SITE IMAGES. Pictures the admin adds in Admin > Images (image links, no upload).
// They power: the Muaaz Iqbal page gallery, the home feed's "Muaaz Iqbal" cards and the
// image sitemap (Google Images / search). Cached, with a public REST fallback.
import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from './firebase-admin';
import { restList } from './firestore-rest';
import { quotaTripped } from './quota';
import { IMAGES_COLLECTION, cleanImage } from './images';

export { IMAGES_COLLECTION, cleanImage };

const read = unstable_cache(async (group) => {
  try {
    if (!adminReady() || quotaTripped()) return [];
    let q = adminDb().collection(IMAGES_COLLECTION);
    if (group) q = q.where('group', '==', group);
    const snap = await q.orderBy('atMs', 'desc').limit(120).get();
    return snap.docs.map((d) => cleanImage({ id: d.id, ...d.data() })).sort((a, b) => b.atMs - a.atMs);
  } catch (e) {
    console.error('images read failed:', e.message);
    return [];
  }
}, ['mz-site-images-v1'], { revalidate: 60, tags: ['images'] });

export const getSiteImages = (group = '') => read(group);
// Muaaz Iqbal's photos: shown on /muaaz-iqbal, in the home feed and in the sitemap.
export const getMuaazImages = () => read('muaaz');

// Fallback when the Admin SDK is missing: the public REST read (rules allow reading siteImages).
export async function getSiteImagesRest(group = '') {
  try {
    const docs = await restList(IMAGES_COLLECTION);
    return docs
      .map((d) => cleanImage({ id: d.id, ...d.data() }))
      .filter((i) => !group || i.group === group)
      .sort((a, b) => b.atMs - a.atMs)
      .slice(0, 120);
  } catch { return []; }
}
