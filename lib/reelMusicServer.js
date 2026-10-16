import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from './firebase-admin';
import { REEL_MUSIC_DEFAULT, REEL_MUSIC_DOC, cleanReelMusic, musicForViewer } from './reelMusic';

// Server side: reads the admin's music setting once and keeps it in the data cache (quota saver, same as the shop data).
// Cleared by /api/revalidate (tag "reel-music") the moment the admin saves a new link.
// If Firebase is not set up, the Vercel variable NEXT_PUBLIC_REEL_MUSIC_URL is used instead.
async function readMusic() {
  const fallback = { ...REEL_MUSIC_DEFAULT, url: process.env.NEXT_PUBLIC_REEL_MUSIC_URL || '' };
  try {
    if (!adminReady()) return musicForViewer(fallback);
    const d = await adminDb().collection(REEL_MUSIC_DOC.collection).doc(REEL_MUSIC_DOC.id).get();
    const cfg = d.exists ? cleanReelMusic({ ...fallback, ...d.data() }) : { ok: true, value: fallback };
    return musicForViewer(cfg.ok ? cfg.value : fallback);
  } catch (e) {
    console.error('reel music read failed:', e.message);
    return musicForViewer(fallback);
  }
}

export const getReelMusic = unstable_cache(readMusic, ['mz-reel-music-v1'], { revalidate: 3600, tags: ['reel-music'] });
