import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminApp, adminDb } from '@/lib/firebase-admin';
import { verifyReseller } from '@/lib/resellerAuth';
import { IPTV, cleanMac, randomMac } from '@/lib/iptv';
import {
  addMonths, canAddLine, cleanClient, clientPrice, cycleState, credentials, resellerStats,
} from '@/lib/iptvReseller';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

// Reseller panel ka API. Har request Firebase ID token ke saath aati hai aur har line
// `resellerId` se bandhi hoti hai — reseller kisi doosre ki line ko chhoo nahi sakta.
//
//   { action:'me' }                          -> profile + clients + numbers + cycle
//   { action:'createClient', name, phone, plan, months, price, email?, device? }
//   { action:'renew', id, months }
//   { action:'suspend', id } / { action:'resume', id } / { action:'cancel', id }
//   { action:'setPrice', price }             -> sirf NAYE clients par lagta hai
//   { action:'setPayment', jazzcash, easypaisa, bank, accountName }
export async function POST(req) {
  const s = await verifyReseller(req);
  if (!s.ok) return json({ ok: false, error: s.error, code: s.code || '' }, s.status);

  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }

  const db = adminDb();
  const action = String(b.action || 'me');
  const me = s.reseller;

  try {
    if (action === 'me') {
      const snap = await db.collection('iptvLines').where('resellerId', '==', s.uid).limit(300).get();
      const lines = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((x, y) => (Number(y.createdAt) || 0) - (Number(x.createdAt) || 0));
      const stats = resellerStats(lines);
      return json({
        ok: true,
        reseller: { name: me.name || '', phone: me.phone || '', price: clientPrice(me.price), credit: Number(me.credit) || 0, payment: me.payment || {} },
        lines,
        stats,
        cycle: cycleState(),
        cycleInfo: { from: IPTV.cycle.from, to: IPTV.cycle.to, suspendDay: IPTV.suspendDay, wholesale: IPTV.wholesale, cap: IPTV.cap },
      });
    }

    if (action === 'createClient') {
      const c = cleanClient(b, me);
      if (!c.ok) return json({ ok: false, error: c.error }, 400);

      const mine = await db.collection('iptvLines').where('resellerId', '==', s.uid).limit(300).get();
      const active = mine.docs.map((d) => d.data()).filter((l) => l.status !== 'cancelled');
      const gate = canAddLine(me, active.length);
      if (!gate.ok) return json({ ok: false, error: gate.error, credit: gate }, 403);

      // Client ka Mizanora account ho to line usi uid par bandhein, taake /account/iptv par dikhe.
      let uid = '';
      if (c.data.email) {
        try { const u = await getAuth(adminApp()).getUserByEmail(c.data.email); uid = u.uid; } catch { uid = ''; }
      }

      const { username, password } = credentials();
      const mac = c.data.device === 'mag' ? randomMac() : '';
      const doc = {
        resellerId: s.uid,
        resellerName: me.name || '',
        resellerPhone: me.phone || '',
        clientName: c.data.name,
        phone: c.data.phone,
        email: c.data.email || '',
        uid,
        username,
        password,
        mac,
        server: process.env.NEXT_PUBLIC_IPTV_SERVER || 'http://dns.mizanora.tv:8080',
        plan: c.data.plan,
        maxDevices: c.data.devices,
        price: c.data.price,              // is line ka rate lock — reseller badle to yeh nahi badalta
        months: c.data.months,
        locked: true,
        expiresAt: c.data.expiresAt,
        status: 'active',
        trial: false,
        createdAt: Date.now(),
        paidThisCycle: 0,
      };
      const ref = await db.collection('iptvLines').add(doc);
      await db.collection('iptvEvents').add({
        type: 'line_created', lineId: ref.id, resellerId: s.uid, at: Date.now(),
      }).catch(() => {});

      return json({
        ok: true,
        line: { id: ref.id, ...doc },
        remaining: Math.max(0, gate.remaining - 1),
        total: c.data.total,
        margin: c.data.price - IPTV.wholesale,
      });
    }

    const id = String(b.id || '');
    if (!id) return json({ ok: false, error: 'Line ID missing' }, 400);

    const ref = db.collection('iptvLines').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return json({ ok: false, error: 'Line nahi mili.' }, 404);
    const line = snap.data();
    if (line.resellerId !== s.uid) return json({ ok: false, error: 'Ye line aap ki nahi hai.' }, 403);

    if (action === 'renew') {
      const months = [1, 3, 12].includes(Number(b.months)) ? Number(b.months) : 1;
      const now = Date.now();
      const from = Math.max(now, Number(line.expiresAt) || now);
      const expiresAt = addMonths(from, months);
      const amount = clientPrice(line.price) * months;
      await ref.update({ expiresAt, status: 'active', months, lastPaymentAt: now, paidThisCycle: amount });
      await db.collection('iptvPayments').add({
        resellerId: s.uid, lineId: id, months, amount, at: now, kind: 'renewal',
        wholesale: IPTV.wholesale * months,
      }).catch(() => {});
      return json({ ok: true, expiresAt, amount });
    }

    if (action === 'suspend') {
      await ref.update({ status: 'suspended', suspendedAt: Date.now() });
      return json({ ok: true });
    }

    if (action === 'resume') {
      const exp = Number(line.expiresAt) || 0;
      if (exp <= Date.now()) return json({ ok: false, error: 'Expiry guzar gayi — pehle renew karein.' }, 400);
      await ref.update({ status: 'active', suspendedAt: 0 });
      return json({ ok: true });
    }

    if (action === 'cancel') {
      await ref.update({ status: 'cancelled', cancelledAt: Date.now() });
      return json({ ok: true });
    }

    if (action === 'setPrice') {
      const price = clientPrice(b.price);
      await db.collection('iptvResellers').doc(s.uid).update({ price, priceUpdatedAt: Date.now() });
      return json({ ok: true, price, note: 'Sirf naye clients par lagega — purane rate par chalte rahenge.' });
    }

    if (action === 'setPayment') {
      const payment = {
        jazzcash: String(b.jazzcash || '').replace(/\D/g, '').slice(0, 11),
        easypaisa: String(b.easypaisa || '').replace(/\D/g, '').slice(0, 11),
        bank: String(b.bank || '').slice(0, 40),
        accountName: String(b.accountName || '').slice(0, 40),
      };
      await db.collection('iptvResellers').doc(s.uid).update({ payment });
      return json({ ok: true, payment });
    }

    if (action === 'setMac') {
      const mac = cleanMac(b.mac);
      if (!mac) return json({ ok: false, error: 'MAC 12 hex digits ka hota hai (00:1A:79:..).' }, 400);
      await ref.update({ mac });
      return json({ ok: true, mac });
    }

    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('reseller api:', e.message);
    return json({ ok: false, error: 'Server error — dobara koshish karein.' }, 500);
  }
}

export async function GET() {
  return json({ ok: false, error: 'POST karein.' }, 405);
}
