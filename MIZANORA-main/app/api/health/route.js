import { NextResponse } from 'next/server';
import { adminCheck, adminReady } from '@/lib/firebase-admin';
import { restReady } from '@/lib/firestore-rest';
import { getProducts, getTotalCount } from '@/lib/products';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let probe = { t: 0, ok: null, msg: '' }; // the write test runs at most once every 5 minutes (it is itself one write)

// Public setup check. Returns only yes/no flags and counts, never secret values.
export async function GET() {
  const products = await getProducts();
  const admin = await adminCheck();
  // A real write test: when the free daily write/read quota is used up, orders fail even though the key is fine. Say so plainly.
  let writeOk = null, writeProblem = '';
  if (admin.ok && Date.now() - probe.t < 5 * 60e3) { writeOk = probe.ok; writeProblem = probe.msg; }
  else if (admin.ok) {
    try { const r = adminDb().collection('_health').doc('ping'); await r.set({ at: Date.now() }); writeOk = true; } catch (e) {
      writeOk = false;
      writeProblem = /RESOURCE_EXHAUSTED|quota|8 /i.test(String(e.message)) ? 'The free Firebase quota (Spark plan) is used up for today. Orders and saving fail until it resets (about midnight Pacific time) or you switch to the Blaze plan. Move old products to the archive (Admin > Archive) to stop this.' : `Firestore write failed: ${String(e.message).slice(0, 120)}`;
    }
  }
  if (admin.ok) probe = { t: Date.now(), ok: writeOk, msg: writeProblem };
  let total = products.length;
  try { total = await getTotalCount(); } catch { /* keep the list size */ }
  return NextResponse.json({
    firebaseWebConfig: restReady(),
    firebaseAdminKey: adminReady(),
    ordersCanBeSaved: admin.ok && writeOk !== false,
    ordersProblem: admin.ok ? (writeOk === false ? writeProblem : null) : admin.reason,
    totalProducts: total,
    imgbbKey: Boolean(process.env.IMGBB_API_KEY),
    geminiAiSearch: Boolean(process.env.GEMINI_API_KEY),
    metaPixel: Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID),
    metaCapiToken: Boolean(process.env.META_CAPI_TOKEN),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || null,
    productsVisibleOnSite: products.length,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
