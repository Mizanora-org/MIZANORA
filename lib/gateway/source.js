import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from '../firebase-admin';
import { quotaTripped } from '../quota';
import { SOURCE_DOC, cleanSource } from './sourceConfig';

// IPTV GATEWAY — upstream source (jahan se asli channels aate hain).
// Yeh SIRF server par rehta hai: `siteMeta/iptvSource`, aur Firestore rules mein browser ke
// liye read band. Client ko kabhi host/username/password nahi milta.
// Pure helpers `sourceConfig.js` mein hain (test unhein seedha load karte hain).

export { SOURCE_DOC, cleanSource, sourceReady, apiBase, upstreamStreamUrl } from './sourceConfig';

const read = unstable_cache(async () => {
  try {
    if (!adminReady() || quotaTripped()) return cleanSource({});
    const snap = await adminDb().collection(SOURCE_DOC.collection).doc(SOURCE_DOC.id).get();
    return snap.exists ? cleanSource(snap.data() || {}) : cleanSource({});
  } catch (e) {
    console.error('iptv source read failed:', e.message);
    return cleanSource({});
  }
}, ['mz-iptv-source-v1'], { revalidate: 120, tags: ['iptv-source'] });

export const getSource = () => read();
