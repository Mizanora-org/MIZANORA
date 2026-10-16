import crypto from 'crypto';
import { denyIf } from '@/lib/siteGate';
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { verifyUser } from '@/lib/workerAuth';
import { normalizePhone } from '@/lib/validate';
import { cnicDigits, validCnic } from '@/lib/workers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (b, s = 200) => NextResponse.json(b, { status: s });
const str = (v, max) => String(v || '').trim().slice(0, max);
const isImg = (s) => /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s || '') && s.length <= 420000;
const METHODS = ['JazzCash', 'Easypaisa', 'Bank account'];

async function newCode(db, name) {
  const stem = String(name).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4).padEnd(4, 'X');
  for (let i = 0; i < 6; i++) {
    const code = `${stem}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const q = await db.collection('workers').where('code', '==', code).limit(1).get();
    if (q.empty) return code;
  }
  return `W${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

// A customer account applies to become a worker. KYC photos and the CNIC number go to the private "workerKyc" collection
// (only the admin can read it). The "workers" doc holds only what the worker needs to see.
export async function POST(req) {
  const closed = await denyIf('workers');
  if (closed) return closed;
  const u = await verifyUser(req);
  if (!u.ok) return json({ ok: false, error: u.error }, u.status);
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'Invalid request' }, 400); }

  const fullName = str(b.fullName, 80), city = str(b.city, 60), address = str(b.address, 250);
  const ph = normalizePhone(b.phone);
  const method = METHODS.includes(b.payoutMethod) ? b.payoutMethod : '';
  const payoutAccount = str(b.payoutAccount, 40), payoutName = str(b.payoutName, 80);
  const how = str(b.how, 400), social = str(b.social, 200);

  if (fullName.length < 3) return json({ ok: false, error: 'Please enter your full name as on your CNIC.' }, 400);
  if (!ph) return json({ ok: false, error: 'Enter a valid mobile number, e.g. 0300-1234567.' }, 400);
  if (!validCnic(b.cnic)) return json({ ok: false, error: 'CNIC must have 13 digits.' }, 400);
  if (city.length < 2 || address.length < 10) return json({ ok: false, error: 'Please enter your city and complete address.' }, 400);
  if (!method || payoutAccount.length < 6 || payoutName.length < 3) return json({ ok: false, error: 'Please enter your payout method, account number and account title.' }, 400);
  if (!b.over18 || !b.agree) return json({ ok: false, error: 'You must be 18 or older and accept the worker rules.' }, 400);
  if (!isImg(b.cnicFront) || !isImg(b.cnicBack) || !isImg(b.selfie)) return json({ ok: false, error: 'Please upload CNIC front, CNIC back and a selfie (clear photos).' }, 400);

  const db = adminDb();
  const ref = db.collection('workers').doc(u.uid);
  const old = await ref.get();
  if (old.exists && old.data().status !== 'rejected') return json({ ok: false, error: 'You have already applied.' }, 409);

  // One CNIC = one worker account (stops fake duplicate accounts)
  const hash = crypto.createHash('sha256').update(`mz:${cnicDigits(b.cnic)}`).digest('hex');
  const hashRef = db.collection('workerCnic').doc(hash);
  const h = await hashRef.get();
  if (h.exists && h.data().uid !== u.uid) return json({ ok: false, error: 'This CNIC is already registered with another worker account.' }, 409);

  const code = old.exists ? old.data().code : await newCode(db, fullName);
  const now = Date.now();
  await db.collection('workerKyc').doc(u.uid).set({
    uid: u.uid, cnic: cnicDigits(b.cnic), cnicFront: b.cnicFront, cnicBack: b.cnicBack, selfie: b.selfie, submittedAtMs: now,
  });
  await hashRef.set({ uid: u.uid, atMs: now });
  await ref.set({
    uid: u.uid, code, email: u.email, name: fullName, phone: ph.local, city, address,
    payout: { method, account: payoutAccount, title: payoutName }, how, social,
    status: 'pending', tierKey: 'starter', customAllowed: false, rateOverride: 0, markups: {},
    stats: old.exists && old.data().stats ? old.data().stats : { orders: 0, delivered: 0, returned: 0, cancelled: 0 },
    createdAtMs: old.exists ? old.data().createdAtMs : now, appliedAtMs: now, rejectReason: FieldValue.delete(),
  }, { merge: true });
  return json({ ok: true, code });
}
