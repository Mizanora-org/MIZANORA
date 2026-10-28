// ============================================================================
// MIZANORA ADS API (v31) - server side: reads, keys, stats
// ----------------------------------------------------------------------------
// Everything here runs in a server route (Admin SDK when configured, public
// Firestore REST as a fallback). The browser never talks to these collections
// directly - the admin panel goes through /api/admin/ads, and the embed script
// goes through /api/ads/serve + /api/ads/{impression,click}.
//
// Firestore collections:
//   ads/{id}       - campaigns (public read, admin write)
//   adKeys/{id}    - API keys (server only; the secret is stored as a hash)
//   adStats/{id}   - per-campaign stats (server only, atomic FieldValue.increment)
//   siteMeta/ads   - the Ads API settings (public read, admin write)
// ============================================================================
import { unstable_cache, revalidateTag } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { createHash, randomBytes } from 'node:crypto';
import { adminDb, adminReady } from './firebase-admin';
import { restList, restGet, restReady } from './firestore-rest';
import { quotaTripped } from './quota';
import { signToken, verifyToken } from './adsToken';
import {
  cleanAd, cleanConfig, cleanStats, todayKey, budgetLeft, pickAds, buildCreative,
  KEY_PREFIX, AD_TYPE_IDS, keyPrefixOf,
} from './ads';

export { KEY_PREFIX, AD_TYPE_IDS, keyPrefixOf };
export const AD_COLLECTION = 'ads';
export const KEY_COLLECTION = 'adKeys';
export const STATS_COLLECTION = 'adStats';
export const CONFIG_DOC = { collection: 'siteMeta', id: 'ads' };

// ---------------------------------------------------------------------------
// SETTINGS (siteMeta/ads)
// ---------------------------------------------------------------------------
const readConfig = unstable_cache(async () => {
  try {
    if (!adminReady() || quotaTripped()) return cleanConfig({});
    const d = await adminDb().collection(CONFIG_DOC.collection).doc(CONFIG_DOC.id).get();
    return cleanConfig(d.exists ? d.data() : {});
  } catch (e) { console.error('ads config read failed:', e.message); return cleanConfig({}); }
}, ['mz-ads-config-v1'], { revalidate: 60, tags: ['ads'] });

export const getAdsConfig = () => readConfig();
export async function readAdsConfigDoc() {
  if (!adminReady()) return cleanConfig({});
  try {
    const d = await adminDb().collection(CONFIG_DOC.collection).doc(CONFIG_DOC.id).get();
    return cleanConfig(d.exists ? d.data() : {});
  } catch { return cleanConfig({}); }
}
export async function writeAdsConfig(cfg) {
  const clean = cleanConfig(cfg);
  await adminDb().collection(CONFIG_DOC.collection).doc(CONFIG_DOC.id).set({ ...clean, updatedAt: Date.now() }, { merge: true });
  return clean;
}

// ---------------------------------------------------------------------------
// KEYS
// ---------------------------------------------------------------------------
export const newKey = () => KEY_PREFIX + randomBytes(18).toString('base64url');
export const hashKey = (k) => createHash('sha256').update(String(k || '')).digest('hex');
export const keyIdOfHash = (k) => hashKey(k);

export async function findKeyDoc(fullKey) {
  const hash = hashKey(fullKey);
  if (!adminReady()) return null;
  const d = await adminDb().collection(KEY_COLLECTION).doc(hash).get();
  return d.exists ? { id: d.id, data: d.data() } : null;
}

// ---------------------------------------------------------------------------
// ACTIVE ADS (cached: the whole catalogue of ads is small)
// ---------------------------------------------------------------------------
const readAds = unstable_cache(async () => {
  try {
    if (!adminReady() || quotaTripped()) return [];
    const snap = await adminDb().collection(AD_COLLECTION).get();
    const ads = snap.docs.map((d) => cleanAd({ id: d.id, ...d.data() }));
    return ads.sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt);
  } catch (e) { console.error('ads read failed:', e.message); return []; }
}, ['mz-ads-v1'], { revalidate: 45, tags: ['ads'] });

export const getActiveAds = () => readAds();

// Fallback for when the Admin SDK is not configured: the public REST read
// (works because firestore.rules lets everyone read /ads).
export async function getActiveAdsRest() {
  try {
    const docs = await restList(AD_COLLECTION);
    return docs.map((d) => cleanAd({ id: d.id, ...d.data() }));
  } catch { return []; }
}

export async function readAdsDoc(id) {
  if (!adminReady()) return cleanAd({ id });
  const d = await adminDb().collection(AD_COLLECTION).doc(String(id || '').replace(/[^\w-]/g, '').slice(0, 60)).get();
  return d.exists ? cleanAd({ id: d.id, ...d.data() }) : cleanAd({ id });
}
export async function writeAdDoc(doc) {
  const clean = cleanAd(doc);
  await adminDb().collection(AD_COLLECTION).doc(clean.id).set(clean);
  revalidateTag('ads');
  return clean;
}
export async function deleteAdDoc(id) {
  const clean = String(id || '').replace(/[^\w-]/g, '').slice(0, 60);
  if (!clean) throw new Error('bad id');
  await adminDb().collection(AD_COLLECTION).doc(clean).delete();
  revalidateTag('ads');
  return clean;
}

// ---------------------------------------------------------------------------
// STATS
// ---------------------------------------------------------------------------
// One atomic increment per campaign + per key. Firestore FieldValue.increment
// is server-side atomic, so concurrent viewers can never lose a count.
const statsCache = { t: 0, byId: {} };
export async function getStatsMap() {
  if (Date.now() - statsCache.t < 20e3) return statsCache.byId;
  const byId = {};
  if (adminReady() && !quotaTripped()) {
    try {
      const snap = await adminDb().collection(STATS_COLLECTION).get();
      snap.docs.forEach((d) => { byId[d.id] = cleanStats(d.data()); });
    } catch (e) { console.error('ads stats read failed:', e.message); }
  }
  statsCache.t = Date.now();
  statsCache.byId = byId;
  return byId;
}

export async function creditImpression(campaignId, keyId = '') {
  const cid = String(campaignId || '').replace(/[^\w-]/g, '').slice(0, 60);
  if (!cid || !adminReady()) return;
  const db = adminDb();
  const batch = db.batch();
  batch.set(db.collection(STATS_COLLECTION).doc(cid), {
    impressions: FieldValue.increment(1),
    days: { [todayKey()]: { i: FieldValue.increment(1), c: FieldValue.increment(0) } },
    updatedAt: Date.now(),
  }, { merge: true });
  if (keyId && keyId !== cid) {
    batch.set(db.collection(KEY_COLLECTION).doc(keyId), {
      stats: { impressions: FieldValue.increment(1), clicks: FieldValue.increment(0) },
      lastSeen: Date.now(),
    }, { merge: true });
  }
  await batch.commit().catch((e) => console.error('ads impression write failed:', e.message));
  statsCache.t = 0; // the cache is stale now
}

export async function creditClick(campaignId, keyId = '') {
  const cid = String(campaignId || '').replace(/[^\w-]/g, '').slice(0, 60);
  if (!cid || !adminReady()) return;
  const db = adminDb();
  const batch = db.batch();
  batch.set(db.collection(STATS_COLLECTION).doc(cid), {
    clicks: FieldValue.increment(1),
    days: { [todayKey()]: { c: FieldValue.increment(1) } },
    updatedAt: Date.now(),
  }, { merge: true });
  if (keyId && keyId !== cid) {
    batch.set(db.collection(KEY_COLLECTION).doc(keyId), {
      stats: { clicks: FieldValue.increment(1), impressions: FieldValue.increment(0) },
      lastSeen: Date.now(),
    }, { merge: true });
  }
  await batch.commit().catch((e) => console.error('ads click write failed:', e.message));
  statsCache.t = 0;
}

export async function resetStats(campaignId = '') {
  const db = adminDb();
  const snap = await db.collection(STATS_COLLECTION).get();
  const batch = db.batch();
  for (const d of snap.docs) {
    if (campaignId && d.id !== campaignId) continue;
    batch.delete(d.ref);
  }
  await batch.commit().catch((e) => console.error('ads stats reset failed:', e.message));
  statsCache.t = 0;
  return { cleared: campaignId || 'all' };
}

// ---------------------------------------------------------------------------
// SERVING: validate a key, filter ads, pick the best ones
// ---------------------------------------------------------------------------
export async function validateKey(key) {
  const k = String(key || '').trim().slice(0, 120);
  if (!k) return { ok: false, error: 'Missing API key.' };
  if (k === 'self') return { ok: true, keyId: 'self', self: true };
  if (!k.startsWith(KEY_PREFIX)) return { ok: false, error: 'Wrong key format.' };
  const doc = await findKeyDoc(k);
  if (!doc) return { ok: false, error: 'Invalid API key.' };
  const d = doc.data;
  if (d.revoked) return { ok: false, error: 'This key was revoked.' };
  if (d.expiresAt && Number(d.expiresAt) > 0 && Date.now() > Number(d.expiresAt)) return { ok: false, error: 'This key expired.' };
  return { ok: true, keyId: doc.id, keyDoc: d };
}

// key -> list of campaign ids it may show ('all' = everything)
function keyAllows(keyDoc, adId) {
  if (!keyDoc) return true;
  const allowed = Array.isArray(keyDoc.allowedAds) ? keyDoc.allowedAds : [];
  return allowed.includes('all') || allowed.includes(adId);
}

function scheduleOk(ad, now = Date.now()) {
  return (!ad.startAt || ad.startAt <= now) && (!ad.endAt || ad.endAt > now);
}

// The full serve pipeline: config -> ads -> stats -> budget -> pick -> creatives.
export async function serveAds({ key, slot = '', count = 1, selfOrigin = '' }) {
  const cfg = await getAdsConfig();
  if (!cfg.enabled) return { ok: false, error: 'Ads are switched off.' };
  const v = await validateKey(key);
  if (!v.ok) return { ok: false, error: v.error };
  if (v.self && selfOrigin && selfOrigin !== new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://mizanora.vercel.app').origin) {
    return { ok: false, error: 'Self ads only run on the shop itself.' };
  }
  const keyId = v.keyId;
  const now = Date.now();

  let ads = await getActiveAds();
  if (!ads.length && restReady()) ads = await getActiveAdsRest();
  const stats = await getStatsMap();

  const allowed = ads.filter((a) => {
    if (!scheduleOk(a, now)) return false;
    if (budgetLeft(a, stats[a.id]) <= 0) return false;
    if (!keyAllows(v.keyDoc, a.id)) return false;
    return true;
  });
  if (!allowed.length) return { ok: true, ads: [], rotateMs: cfg.rotateMs, count: 0 };

  const picked = pickAds(allowed, stats, { count: Math.max(1, Math.min(cfg.maxAdsPerKey, count || 1)), autoOptimize: cfg.autoOptimize, type: slot });
  const adsOut = picked.map((a) => buildCreative(a, { token: signToken(keyId, a.id, 60000) }));
  return { ok: true, ads: adsOut, rotateMs: cfg.rotateMs, count: adsOut.length };
}
