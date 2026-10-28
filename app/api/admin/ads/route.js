import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { quotaTripped } from '@/lib/quota';
import {
  AD_COLLECTION, KEY_COLLECTION, STATS_COLLECTION, CONFIG_DOC,
  getAdsConfig, readAdsConfigDoc, writeAdsConfig,
  writeAdDoc, deleteAdDoc, readAdsDoc, newKey, hashKey,
  getStatsMap, resetStats, keyPrefixOf,
} from '@/lib/adsServer';
import { cleanAd, cleanStats, buildCreative, AD_TYPES, ANIM_PRESETS } from '@/lib/ads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const json = (b, s = 200) => NextResponse.json(b, { status: s });
const DAY = 86400000;

// Admin only. THE ADS API CONTROL PANEL.
//  get                                -> { ads, keys, config, stats }
//  saveAd     { ad }                  -> create or update a campaign
//  deleteAd   { id }
//  createKey  { name, expiresDays, allowedAds } -> { key } (shown ONCE)
//  revokeKey  { id }
//  setConfig  { config }              -> the master switches (auto-optimise, shop ads...)
//  resetStats { campaignId }
//  preview    { ad }                  -> the creative exactly as the browser receives it
export async function GET(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: false, error: 'Firebase Admin is not set up (FIREBASE_SERVICE_ACCOUNT in Vercel).' }, 503);
  const db = adminDb();
  const [adsSnap, keysSnap, statsSnap, cfg] = await Promise.all([
    db.collection(AD_COLLECTION).get().catch(() => ({ docs: [] })),
    db.collection(KEY_COLLECTION).get().catch(() => ({ docs: [] })),
    db.collection(STATS_COLLECTION).get().catch(() => ({ docs: [] })),
    readAdsConfigDoc(),
  ]);
  const stats = {};
  statsSnap.docs.forEach((d) => { stats[d.id] = cleanStats(d.data()); });
  const ads = adsSnap.docs.map((d) => cleanAd({ id: d.id, ...d.data() })).sort((x, y) => y.priority - x.priority || y.createdAt - x.createdAt);
  const keys = keysSnap.docs.map((d) => ({
    id: d.id,
    name: d.data().name || 'Key',
    prefix: d.data().prefix || keyPrefixOf(d.id),
    createdAt: Number(d.data().createdAt) || 0,
    expiresAt: Number(d.data().expiresAt) || 0,
    revoked: Boolean(d.data().revoked),
    allowedAds: Array.isArray(d.data().allowedAds) ? d.data().allowedAds : [],
    stats: { impressions: Number((d.data().stats || {}).impressions) || 0, clicks: Number((d.data().stats || {}).clicks) || 0 },
    lastSeen: Number(d.data().lastSeen) || 0,
  })).sort((x, y) => y.createdAt - x.createdAt);
  return json({ ok: true, ads, keys, config: cfg, stats, types: AD_TYPES, anims: ANIM_PRESETS });
}

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: false, error: 'Firebase Admin is not set up (FIREBASE_SERVICE_ACCOUNT in Vercel).' }, 503);
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  const act = String(b.action || '');
  const db = adminDb();

  try {
    if (act === 'saveAd') {
      const ad = await writeAdDoc({ ...b.ad, id: b.ad && b.ad.id, createdAt: b.ad && b.ad.createdAt });
      return json({ ok: true, ad });
    }

    if (act === 'deleteAd') {
      const id = await deleteAdDoc(b.id);
      return json({ ok: true, id });
    }

    if (act === 'createKey') {
      const name = String(b.name || '').replace(/[<>]/g, '').trim().slice(0, 80) || 'Ads key';
      const expiresDays = Math.max(0, Math.min(3650, Math.floor(Number(b.expiresDays)) || 365));
      const allowedAds = Array.isArray(b.allowedAds)
        ? b.allowedAds.map(String).filter((x) => /^\w{1,60}$/.test(x)).slice(0, 20)
        : [];
      const full = newKey();
      const hash = hashKey(full);
      await db.collection(KEY_COLLECTION).doc(hash).set({
        name,
        prefix: keyPrefixOf(full),
        createdAt: Date.now(),
        expiresAt: expiresDays > 0 ? Date.now() + expiresDays * DAY : 0,
        revoked: false,
        allowedAds: allowedAds.length ? allowedAds : ['all'],
        stats: { impressions: 0, clicks: 0 },
        lastSeen: 0,
      });
      // The full key is returned ONCE - only the hash stays in Firestore.
      return json({ ok: true, key: full, prefix: keyPrefixOf(full), name, expiresDays, allowedAds: allowedAds.length ? allowedAds : ['all'] });
    }

    if (act === 'revokeKey') {
      await db.collection(KEY_COLLECTION).doc(String(b.id || '').replace(/[^\w-]/g, '').slice(0, 64)).set({ revoked: true, revokedAt: Date.now() }, { merge: true });
      return json({ ok: true, id: b.id });
    }

    if (act === 'setConfig') {
      const cfg = await writeAdsConfig(b.config || {});
      return json({ ok: true, config: cfg });
    }

    if (act === 'resetStats') {
      return json({ ok: true, ...(await resetStats(b.campaignId || '')) });
    }

    if (act === 'preview') {
      const ad = cleanAd({ ...(b.ad || {}) });
      return json({ ok: true, creative: buildCreative(ad, { token: 'preview' }) });
    }

    return json({ ok: false, error: 'Unknown action.' }, 400);
  } catch (e) {
    console.error('admin ads error:', e);
    return json({ ok: false, error: e.message || 'Could not complete the action.' }, 500);
  }
}
