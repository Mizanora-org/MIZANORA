import { NextResponse } from 'next/server';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { cleanApply } from '@/lib/iptvReseller';

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

  try {
    if (ip) {
      const since = Date.now() - 86400e3;
      const recent = await db.collection('iptvResellerApps').where('ip', '==', ip).where('at', '>=', since).limit(4).get().catch(() => null);
      if (recent && recent.size >= 3) {
        return json({ ok: false, error: 'Is number se aaj 3 applications ho chuki hain — kal koshish karein.' }, 429);
      }
    }

    const ref = await db.collection('iptvResellerApps').add({
      ...c.data,
      ip,
      uid: String(b.uid || '').slice(0, 64),
      status: 'new',
      createdAt: Date.now(),
    });

    return json({ ok: true, id: ref.id });
  } catch (e) {
    console.error('reseller apply:', e.message);
    return json({ ok: false, error: 'Application save nahi hui — WhatsApp par bhejein.' }, 500);
  }
}

export async function GET() {
  return json({ ok: false, error: 'POST karein.' }, 405);
}
