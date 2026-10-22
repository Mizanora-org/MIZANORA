import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from './firebase-admin';
import { quotaTripped } from './quota';
import { cleanFeedItem } from './islamic';

// Extra Islamic posts added from Admin > AI Manager (Firestore collection "feedPosts"). Cached 10 minutes, refreshed on every admin change.
const read = unstable_cache(async () => {
  if (!adminReady() || quotaTripped()) return [];
  try {
    const snap = await adminDb().collection('feedPosts').orderBy('createdAt', 'desc').limit(40).get();
    return snap.docs.map((d) => cleanFeedItem({ id: d.id, ...d.data() })).filter(Boolean);
  } catch { return []; }
}, ['mz-feed-posts-v1'], { revalidate: 600, tags: ['feed-posts'] });

export const getFeedPosts = () => read();
