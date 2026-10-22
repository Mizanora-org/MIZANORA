import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from './firebase-admin';
import { quotaTripped } from './quota';
import { QURAN_DEFAULT, QURAN_DOC, apiUrl, cleanQuran, parseSurahResponse, surahInfo } from './quran';

// Server side of the Quran session.
//  * getQuranConfig(): the admin's setting (Firestore siteMeta/quran), kept in the data cache (tag "quran") and cleared the moment the admin saves.
//  * getSurah(): one surah (Arabic + translation + audio links) from AlQuran Cloud, kept for 30 days. A surah that could not be
//    fetched is never cached (the function throws), so one bad moment never sticks.
// Until the admin saves a setting for the first time the session is OFF: nothing starts by surprise on a shop that never asked for it.
const OFF = { ...QURAN_DEFAULT, mode: 'off' };
const readConfig = unstable_cache(async () => {
  try {
    if (!adminReady() || quotaTripped()) return OFF;
    const d = await adminDb().collection(QURAN_DOC.collection).doc(QURAN_DOC.id).get();
    return d.exists ? cleanQuran({ ...QURAN_DEFAULT, ...d.data() }) : OFF;
  } catch (e) { console.error('quran config read failed:', e.message); return OFF; }
}, ['mz-quran-config-v1'], { revalidate: 600, tags: ['quran'] });

export const getQuranConfig = () => readConfig();

async function fetchSurahRaw(surah, reciter, translation) {
  const r = await fetch(apiUrl(surah, reciter, translation), { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`quran api ${r.status}`);
  const j = await r.json();
  const out = parseSurahResponse(j, { reciter, translation });
  if (!out) throw new Error('quran api: unexpected answer');
  return out;
}
const cachedSurah = unstable_cache(fetchSurahRaw, ['mz-quran-surah-v1'], { revalidate: 30 * 24 * 3600, tags: ['quran-text'] });

export async function getSurah(surah, reciter, translation) {
  const n = surahInfo(surah).n;
  try { return await cachedSurah(n, reciter, translation || ''); }
  catch (e) {
    // The translation edition may be missing for a moment: fall back to Arabic + audio only rather than nothing.
    if (translation) return cachedSurah(n, reciter, '');
    throw e;
  }
}
