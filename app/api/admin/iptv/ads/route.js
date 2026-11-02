import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { ADS_DOC, cleanAds } from '@/lib/iptvAds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

// ADS — kisi bhi channel par preroll video ya banner.
//   GET  -> { ads }
//   POST { action:'save', ads } | { action:'clear' }
export async function GET(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: true, ads: cleanAds({}), demo: true });
  const snap = await adminDb().collection(ADS_DOC.collection).doc(ADS_DOC.id).get();
  return json({ ok: true, ads: cleanAds(snap.exists ? snap.data() : {}) });
}

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: false, error: 'Firestore connect karein (FIREBASE_SERVICE_ACCOUNT).' }, 503);

  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  const action = String(b.action || 'save');
  const ref = adminDb().collection(ADS_DOC.collection).doc(ADS_DOC.id);

  if (action === 'clear') {
    await ref.set(cleanAds({ updatedAt: Date.now() }), { merge: false });
    revalidateTag('iptv');
    return json({ ok: true, ads: cleanAds({}) });
  }

  const ads = cleanAds({ ...(b.ads || b), updatedAt: Date.now() });
  if (ads.enabled && !ads.prerollUrl && !ads.imageUrl) {
    return json({ ok: false, error: 'Ad ON hai magar video/banner link nahi diya.' }, 400);
  }
  await ref.set(ads, { merge: false });
  revalidateTag('iptv');
  return json({ ok: true, ads });
}
