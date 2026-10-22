import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from './firebase-admin';
import { quotaTripped } from './quota';
import { DEALS_DEFAULT, DEALS_DOC, cleanDeals } from './deals';

// The admin's setting of the deals page (Firestore siteMeta/deals). Cached, cleared when the admin saves (tag "deals-config").
const read = unstable_cache(async () => {
  try {
    if (!adminReady() || quotaTripped()) return DEALS_DEFAULT;
    const d = await adminDb().collection(DEALS_DOC.collection).doc(DEALS_DOC.id).get();
    return d.exists ? cleanDeals({ ...DEALS_DEFAULT, ...d.data() }) : DEALS_DEFAULT;
  } catch (e) { console.error('deals config read failed:', e.message); return DEALS_DEFAULT; }
}, ['mz-deals-config-v1'], { revalidate: 600, tags: ['deals-config'] });

export const getDealsConfig = () => read();
