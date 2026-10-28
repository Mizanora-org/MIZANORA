import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { cleanImage, IMAGES_COLLECTION } from '@/lib/imagesServer';
import { revalidateTag } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const json = (b, s = 200) => NextResponse.json(b, { status: s });

// Admin only. SITE IMAGES (Admin > Images).
//  get     -> all images, grouped
//  add     { url, title, caption, group }   -> creates one
//  delete  { id }
// Pictures added here appear on /muaaz-iqbal (gallery), in the home feed's
// "Muaaz Iqbal" cards and in the image sitemap - no other wiring needed.
export async function GET(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: false, error: 'Firebase Admin is not set up (FIREBASE_SERVICE_ACCOUNT in Vercel).' }, 503);
  const snap = await adminDb().collection(IMAGES_COLLECTION).orderBy('atMs', 'desc').limit(300).get();
  const images = snap.docs.map((d) => cleanImage({ id: d.id, ...d.data() }));
  const groups = ['muaaz', 'site'];
  const byGroup = {};
  for (const g of [...groups, ...new Set(images.map((i) => i.group))]) byGroup[g] = images.filter((i) => i.group === g);
  return json({ ok: true, images, byGroup });
}

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: false, error: 'Firebase Admin is not set up (FIREBASE_SERVICE_ACCOUNT in Vercel).' }, 503);
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  const act = String(b.action || '');
  const db = adminDb();
  try {
    if (act === 'add') {
      const img = cleanImage(b);
      if (!img.url) return json({ ok: false, error: 'Image link is required.' }, 400);
      // de-duplicate: the same link is not added twice
      const exists = await db.collection(IMAGES_COLLECTION).where('url', '==', img.url).limit(1).get();
      if (!exists.empty) return json({ ok: false, error: 'This image link is already saved.', image: cleanImage({ id: exists.docs[0].id, ...exists.docs[0].data() }) }, 409);
      await db.collection(IMAGES_COLLECTION).doc(img.id).set(img);
      revalidateTag('images');
      return json({ ok: true, image: img });
    }
    if (act === 'delete') {
      const id = String(b.id || '').replace(/[^\w-]/g, '').slice(0, 60);
      await db.collection(IMAGES_COLLECTION).doc(id).delete();
      revalidateTag('images');
      return json({ ok: true, id });
    }
    return json({ ok: false, error: 'Unknown action.' }, 400);
  } catch (e) {
    console.error('admin images error:', e);
    return json({ ok: false, error: e.message || 'Could not complete the action.' }, 500);
  }
}
