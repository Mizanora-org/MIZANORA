import { adminDb, adminReady } from './firebase-admin';

// v29: the YouTube stream key lives in adminSecrets/liveChannelYoutube. Firestore rules deny every browser read/write of
// adminSecrets; only the server (Admin SDK) touches it. Never put a stream key in siteMeta: siteMeta is public.
const REF = ['adminSecrets', 'liveChannelYoutube'];
export async function getYtSecret() {
  try {
    if (!adminReady()) return { key: '', rtmpUrl: '' };
    const d = await adminDb().collection(REF[0]).doc(REF[1]).get();
    const x = d.exists ? d.data() : {};
    return { key: String(x.key || ''), rtmpUrl: String(x.rtmpUrl || '') };
  } catch (e) { console.error('yt secret read failed:', e.message); return { key: '', rtmpUrl: '' }; }
}
export async function setYtSecret({ key, rtmpUrl }) {
  await adminDb().collection(REF[0]).doc(REF[1]).set({ key: String(key || ''), rtmpUrl: String(rtmpUrl || ''), updatedAtMs: Date.now() }, { merge: true });
}
