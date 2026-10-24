import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from './firebase-admin';
import { quotaTripped } from './quota';
import { getProduct } from './products';
import { CHANNEL_DEFAULT, CHANNEL_DOC, cleanChannel, voiceIdOk } from './liveChannel';
import { parseSection, sectionUrl } from './hadith';

// Server side of the Quran & Hadith Live Channel (v27):
//  * getChannelConfig(): the admin's setting (Firestore siteMeta/liveChannel), cached and cleared the moment the admin saves.
//  * getChannelAds(): the products of the ad breaks, read from the shop, so an ad can never show a wrong price.
//  * getHadithSection(): one section of one hadith book (30 days cache) - the text the channel reads on air.
//  * saveVoice / loadVoice / listVoices: the AI voiceovers (Gemini TTS) of the ads and the hadith readings, kept in
//    Firestore in small base64 chunks and served at /api/live/voice/<id>.wav - the exact files the m3u8 playlist points to.
// Until the admin switches the channel on it stays OFF: nothing ever starts by surprise.

const OFF = { ...CHANNEL_DEFAULT, mode: 'off' };
const readConfig = unstable_cache(async () => {
  try {
    if (!adminReady() || quotaTripped()) return OFF;
    const d = await adminDb().collection(CHANNEL_DOC.collection).doc(CHANNEL_DOC.id).get();
    return d.exists ? cleanChannel({ ...CHANNEL_DEFAULT, ...d.data() }) : OFF;
  } catch (e) {
    console.error('live channel config read failed:', e.message);
    return OFF;
  }
}, ['mz-livechannel-config-v1'], { revalidate: 600, tags: ['livechannel'] });

export const getChannelConfig = () => readConfig();

// Products of the ad breaks: name, photos and the REAL price straight from the catalogue.
export async function getChannelAds(slugs) {
  const out = [];
  for (const s of (slugs || []).slice(0, 30)) {
    try {
      const p = await getProduct(s);
      if (p && p.name) {
        out.push({
          slug: p.slug, name: p.name.slice(0, 90),
          image: (p.images && p.images[0]) || '', images: (p.images || []).slice(0, 5),
          price: p.price, comparePrice: p.comparePrice > p.price ? p.comparePrice : 0,
          video: p.video || '', inStock: p.inStock !== false,
        });
      }
    } catch (e) { /* a product that cannot be read is simply not advertised */ }
  }
  return out;
}

// One section of a hadith book (the text the reading uses), cached for 30 days like the Quran surahs.
// Books have different numbers of sections; a section that does not exist simply returns null and the channel keeps
// its own silence-never policy (the reading falls back to the Quran audio in the playlist).
async function fetchSection(book, n, lang) {
  const r = await fetch(sectionUrl(lang, book, n), { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`hadith api ${r.status}`);
  return parseSection(await r.json(), n);
}
const cachedSection = unstable_cache(fetchSection, ['mz-hadith-section-v1'], { revalidate: 30 * 24 * 3600, tags: ['hadith'] });

export async function getHadithSection(book, n, lang) {
  for (let k = 0; k < 2; k++) {
    try {
      const s = await cachedSection(book, n, lang);
      if (s && s.hadiths && s.hadiths.length) return s;
    } catch (e) { if (k === 1) console.error(`hadith ${book} ${n}:`, e.message); }
  }
  return null;
}

// ---- AI voiceovers -----------------------------------------------------------------------------------------------
// A voiceover is one WAV file. Firestore documents cap at 1 MB, so the base64 is cut into pieces:
//   liveVoices/<id>            meta: { id, bytes, mime, text, voiceName, createdAt }
//   liveVoices/<id>/chunks/0   { b64 }   liveVoices/<id>/chunks/1   { b64 }  ...
const CHUNK_CHARS = 450000;
const MAX_VOICE_BYTES = 6 * 1024 * 1024; // about 2 minutes of 24 kHz mono 16-bit

export async function saveVoice(id, wav, meta = {}) {
  const key = String(id || '');
  if (!voiceIdOk(key)) throw new Error('bad voice id');
  const buf = Buffer.isBuffer(wav) ? wav : Buffer.from(wav || []);
  if (!buf.length) throw new Error('empty audio');
  if (buf.length > MAX_VOICE_BYTES) throw new Error('audio is too long (max 2 minutes)');
  const db = adminDb();
  const ref = db.collection('liveVoices').doc(key);
  const b64 = buf.toString('base64');
  const n = Math.ceil(b64.length / CHUNK_CHARS);
  const batch = db.batch();
  for (let i = 0; i < n; i++) batch.set(ref.collection('chunks').doc(String(i)), { b64: b64.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS) });
  batch.set(ref, {
    id: key, bytes: buf.length, mime: 'audio/wav', chunks: n,
    text: String(meta.text || '').slice(0, 600),
    voiceName: String(meta.voiceName || '').slice(0, 24),
    kind: String(meta.kind || '').slice(0, 12),
    createdAt: Date.now(),
  });
  // stale pieces of an older, longer recording of the same id
  for (let i = n; i < 8; i++) batch.delete(ref.collection('chunks').doc(String(i)));
  await batch.commit();
  return { id: key, bytes: buf.length, chunks: n };
}

export async function loadVoice(id) {
  const key = String(id || '');
  if (!voiceIdOk(key)) return null;
  try {
    const db = adminDb();
    const meta = await db.collection('liveVoices').doc(key).get();
    if (!meta.exists) return null;
    const m = meta.data();
    const out = [];
    for (let i = 0; i < Math.min(16, Number(m.chunks) || 1); i++) {
      const c = await meta.ref.collection('chunks').doc(String(i)).get();
      if (!c.exists) return null;
      out.push(Buffer.from(String(c.data().b64 || ''), 'base64'));
    }
    const buf = Buffer.concat(out);
    return buf.length ? buf : null;
  } catch (e) {
    console.error('voice read failed:', e.message);
    return null;
  }
}

export async function deleteVoice(id) {
  const key = String(id || '');
  if (!voiceIdOk(key)) return false;
  const db = adminDb();
  const ref = db.collection('liveVoices').doc(key);
  const meta = await ref.get();
  if (!meta.exists) return false;
  const batch = db.batch();
  for (let i = 0; i < Math.min(16, Number(meta.data().chunks) || 1); i++) batch.delete(ref.collection('chunks').doc(String(i)));
  batch.delete(ref);
  await batch.commit();
  return true;
}

// Ids of every stored voiceover - one cheap query (select() returns only references, no audio), used by the
// m3u8 generator to know which slots have a real voiceover and which should fall back to Quran audio.
export const listVoices = unstable_cache(async () => {
  try {
    if (!adminReady() || quotaTripped()) return [];
    const snap = await adminDb().collection('liveVoices').select().limit(500).get();
    return snap.docs.map((d) => d.id).filter(voiceIdOk);
  } catch (e) {
    console.error('voice list failed:', e.message);
    return [];
  }
}, ['mz-live-voices-v1'], { revalidate: 300, tags: ['livechannel'] });
