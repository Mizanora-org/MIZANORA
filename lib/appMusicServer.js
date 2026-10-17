import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from './firebase-admin';
import { APP_MUSIC_DEFAULT, APP_MUSIC_DOC, cleanAppMusic, musicForViewer } from './appMusic';

// Server side: reads the admin's app-music setting once and keeps it in the data cache
// (quota saver, same as the shop data). The cache is cleared by /api/revalidate (tag "app-music")
// the moment the admin saves a new link, so the shop picks it up within seconds.
// If Firebase is not set up, the Vercel variable NEXT_PUBLIC_APP_MUSIC_URL is used instead.
async function readMusic() {
  const fallback = { ...APP_MUSIC_DEFAULT, url: process.env.NEXT_PUBLIC_APP_MUSIC_URL || '' };
  try {
    if (!adminReady()) return musicForViewer(fallback);
    const d = await adminDb().collection(APP_MUSIC_DOC.collection).doc(APP_MUSIC_DOC.id).get();
    const cfg = d.exists ? cleanAppMusic({ ...fallback, ...d.data() }) : { ok: true, value: fallback };
    return musicForViewer(cfg.ok ? cfg.value : fallback);
  } catch (e) {
    console.error('app music read failed:', e.message);
    return musicForViewer(fallback);
  }
}

export const getAppMusic = unstable_cache(readMusic, ['mz-app-music-v1'], { revalidate: 3600, tags: ['app-music'] });
