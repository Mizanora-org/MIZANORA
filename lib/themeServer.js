import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from './firebase-admin';
import { snapshotGet } from './snapshot';
import { quotaTripped } from './quota';
import { SEASON_MODE, SEASON_MODES } from './season';

// The season look chosen in the admin panel (Firestore siteMeta/theme { season }). Cached for 10 minutes and refreshed instantly
// when the admin changes it (revalidateTag('theme')). With no choice saved, NEXT_PUBLIC_SEASON_THEME (default winter) is used.
const read = unstable_cache(async () => {
  // Archive: the theme is a snapshot in data/snap when the admin captured one -> zero Firestore reads.
  const s = await snapshotGet('theme');
  if (s && s.data) return String(s.data.season || '');
  if (!adminReady() || quotaTripped()) return '';
  try { const d = await adminDb().collection('siteMeta').doc('theme').get(); return d.exists ? String(d.data().season || '') : ''; } catch { return ''; }
}, ['mz-theme-v1'], { revalidate: 86400, tags: ['theme'] });

export async function getThemeMode() {
  const m = String(await read()).toLowerCase();
  return SEASON_MODES.includes(m) ? m : SEASON_MODE;
}
