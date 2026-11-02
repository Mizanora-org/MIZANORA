import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminApp, adminDb, adminReady } from '@/lib/firebase-admin';
import { cleanApply, RESELLER_DEFAULTS } from '@/lib/iptvReseller';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

// Reseller application. Firestore na ho to saaf WhatsApp fallback (form kabhi dead nahi lagta).
// Aik IP se 24 ghante mein 3 se zyada applications nahi — spam se bachne ke liye.
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }

  const c = cleanApply(b);
  if (!c.ok) return json({ ok: false, error: c.error }, 400);

  if (!adminReady()) {
    return json({
      ok: false,
      fallback: true,
      error: 'Online application filhal band hai — WhatsApp par "IPTV reseller" likh kar bhejein.',
    }, 503);
  }

  const db = adminDb();
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 60);

  // AUTO-APPROVE: jis ne Google/email se sign in kiya hai, uski application foran manzoor.
  // Admin baad mein credit/price badal sakta hai ya suspend kar sakta hai.
  // Band karna ho to Vercel env mein IPTV_AUTO_APPROVE=0 laga dein.
  const auto = String(process.env.IPTV_AUTO_APPROVE || '1') !== '0';
  let uid = '';
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (token) {
    try { const d = await getAuth(adminApp()).verifyIdToken(token); uid = d.uid; } catch { uid = ''; }
  }

  try {
    if (ip) {
      const since = Date.now() - 86400e3;
      const recent = await db.collection('iptvResellerApps').where('ip', '==', ip).where('at', '>=', since).limit(4).get().catch(() => null);
      if (recent && recent.size >= 3) {
        return json({ ok: false, error: 'Is number se aaj 3 applications ho chuki hain — kal koshish karein.' }, 429);
      }
    }

    if (auto && uid) {
      const meRef = db.collection('iptvResellers').doc(uid);
      const meSnap = await meRef.get();
      if (meSnap.exists) {
        const r = meSnap.data() || {};
        return json({ ok: true, approved: r.status === 'approved', existing: true, credit: Number(r.credit) || 0, status: r.status || 'approved' });
      }

      const credit = Math.min(50, Math.max(1, Number(process.env.IPTV_RESELLER_CREDIT) || RESELLER_DEFAULTS.credit));
      await meRef.set({
        name: c.data.name,
        phone: c.data.phone,
        whatsapp: c.data.whatsapp,
        city: c.data.city,
        credit,
        price: RESELLER_DEFAULTS.price,
        status: 'approved',
        auto: true,
        payment: {},
        paidThisCycle: 0,
        approvedAt: Date.now(),
        createdAt: Date.now(),
      }, { merge: true });

      const ref = await db.collection('iptvResellerApps').add({
        ...c.data, ip, uid, status: 'approved', auto: true, createdAt: Date.now(), approvedAt: Date.now(),
      }).catch(() => null);

      return json({ ok: true, approved: true, credit, id: ref ? ref.id : '' });
    }

    const ref = await db.collection('iptvResellerApps').add({
      ...c.data,
      ip,
      uid: String(uid || '').slice(0, 64),
      status: 'new',
      createdAt: Date.now(),
    });

    return json({ ok: true, id: ref.id, approved: false });
  } catch (e) {
    console.error('reseller apply:', e.message);
    return json({ ok: false, error: 'Application save nahi hui — WhatsApp par bhejein.' }, 500);
  }
}

export async function GET() {
  return json({ ok: false, error: 'POST karein.' }, 405);
}
