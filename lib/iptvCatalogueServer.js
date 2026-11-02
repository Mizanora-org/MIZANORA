import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from './firebase-admin';
import { quotaTripped } from './quota';
import { IPTV_CATALOGUE, cleanCatalogue } from './iptvCatalogue';

// The IPTV catalogue is small enough to live in one document (max 5,000 channels).
// Cached for 10 minutes and cleared with the "iptv" tag when the admin saves.
const read = unstable_cache(async () => {
  try {
    if (!adminReady() || quotaTripped()) return cleanCatalogue({});
    const snap = await adminDb().collection(IPTV_CATALOGUE.collection).doc(IPTV_CATALOGUE.id).get();
    if (!snap.exists) return cleanCatalogue({});
    return cleanCatalogue(snap.data() || {});
  } catch (e) {
    console.error('iptv catalogue read failed:', e.message);
    return cleanCatalogue({});
  }
}, ['mz-iptv-catalogue-v1'], { revalidate: 600, tags: ['iptv'] });

export const getIptvCatalogue = () => read();
