import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from './firebase-admin';
import { quotaTripped } from './quota';
import { QURAN_DEFAULT, QURAN_DOC, assembleSurah, cleanQuran, editionUrl, parseEdition, surahInfo } from './quran';

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

// One edition of one surah, kept for 30 days. A request that failed throws, so a failure is never cached.
async function fetchEdition(surah, edition) {
  const r = await fetch(editionUrl(surah, edition), { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`quran api ${r.status}`);
  const d = parseEdition(await r.json());
  if (!d) throw new Error('quran api: unexpected answer');
  return d;
}
const cachedEdition = unstable_cache(fetchEdition, ['mz-quran-edition-v2'], { revalidate: 30 * 24 * 3600, tags: ['quran-text'] });
const attempt = async (surah, edition) => {
  for (let k = 0; k < 2; k++) { try { return await cachedEdition(surah, edition); } catch (e) { if (k) { console.error(`quran ${edition} ${surah}:`, e.message); } } }
  return null;
};

// The text, the translation and the voice are fetched SEPARATELY: if one is down the others still arrive.
// Only when neither the Arabic text nor the voice list could be read does it give up (the voice files have computed addresses anyway,
// so the player can still recite without the text).
export async function getSurah(surah, reciter, translation) {
  const n = surahInfo(surah).n;
  const [ar, tr, au] = await Promise.all([attempt(n, 'quran-uthmani'), translation ? attempt(n, translation) : null, attempt(n, reciter)]);
  return assembleSurah(n, { ar, tr, au }, reciter);
}
