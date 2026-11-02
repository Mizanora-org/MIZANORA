import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from '../firebase-admin';
import { ADS_DOC, cleanAds } from '../iptvAds';

// Ads config ka cached read. Admin badle to tag `iptv` clear hota hai — 2 minute mein sab jagah naya.
const read = unstable_cache(async () => {
  try {
    if (!adminReady()) return cleanAds({});
    const snap = await adminDb().collection(ADS_DOC.collection).doc(ADS_DOC.id).get();
    return cleanAds(snap.exists ? snap.data() : {});
  } catch { return cleanAds({}); }
}, ['mz-iptv-ads-v2'], { revalidate: 120, tags: ['iptv'] });

export const getAds = () => read();
