import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/workerAuth';
import { adminDb } from '@/lib/firebase-admin';
import { canClaim, publicLine, trialLine, TRIAL_HOURS } from '@/lib/iptvAccount';
import { credentials } from '@/lib/iptvReseller';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

// Xtream user ka apna account — barakatwave jaisa: sign in, aur free key foran mil jati hai.
//
//   { action:'me' }      -> meri lines + trial ka haq
//   { action:'claim' }   -> 24 ghante ki trial line ban jati hai (admin ka intezaar nahi)
//   { action:'rotate' }  -> meri line ka naya password
//
// Sirf apni line: har query `uid == token.uid` par hoti hai.
export async function POST(req) {
  const u = await verifyUser(req);
  if (!u.ok) return json({ ok: false, error: u.status === 401 ? 'Sign in karein.' : u.error }, u.status);

  let b = {};
  try { b = await req.json(); } catch { b = {}; }
  const action = String(b.action || 'me');
  const db = adminDb();

  try {
    const snap = await db.collection('iptvLines').where('uid', '==', u.uid).limit(10).get();
    const lines = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }))
      .sort((x, y) => (Number(y.createdAt) || 0) - (Number(x.createdAt) || 0));

    if (action === 'me') {
      return json({
        ok: true,
        email: u.email,
        lines: lines.map(publicLine),
        claim: canClaim(lines),
        hours: TRIAL_HOURS,
      });
    }

    if (action === 'claim') {
      const gate = canClaim(lines);
      if (!gate.ok) return json({ ok: false, code: gate.code, error: gate.error }, 409);

      // Name: account ka displayName (client se nahi aata, is liye bharosa na karein).
      const doc = trialLine({
        uid: u.uid,
        email: u.email,
        name: String(b.name || '').slice(0, 60),
        phone: String(b.phone || '').slice(0, 16),
        device: b.device === 'mag' ? 'mag' : 'xtream',
      });

      const ref = await db.collection('iptvLines').add(doc);
      await db.collection('iptvEvents').add({
        type: 'trial_claimed', lineId: ref.id, uid: u.uid, at: Date.now(),
      }).catch(() => {});

      return json({ ok: true, line: publicLine({ id: ref.id, ...doc }), hours: TRIAL_HOURS });
    }

    if (action === 'rotate') {
      const id = String(b.id || '');
      const line = lines.find((l) => l.id === id);
      if (!line) return json({ ok: false, error: 'Ye line aap ki nahi hai.' }, 403);
      const { password } = credentials();
      await db.collection('iptvLines').doc(id).update({ password, rotatedAt: Date.now() });
      return json({ ok: true, password });
    }

    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('iptv account api:', e.message);
    return json({ ok: false, error: 'Server error — dobara koshish karein.' }, 500);
  }
}

export async function GET() {
  return json({ ok: false, error: 'POST karein.' }, 405);
}
