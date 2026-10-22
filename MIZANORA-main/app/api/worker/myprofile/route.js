import { NextResponse } from 'next/server';
import { denyIf } from '@/lib/siteGate';
import { adminDb } from '@/lib/firebase-admin';
import { verifyWorker } from '@/lib/workerAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

// WORKER PUBLIC PROFILE (opt-in). A worker decides whether the public /team page may show their name, city,
// a short line and a photo. Nothing else is ever copied out of the private worker record - no CNIC, no phone,
// no address, no payout details, no earnings.
const clean = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const isImg = (v) => typeof v === 'string' && (/^https:\/\//i.test(v) || /^data:image\//i.test(v)) && v.length < 600;

export async function GET(req) {
  const closed = await denyIf('workers');
  if (closed) return closed;
  const a = await verifyWorker(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  const pp = a.worker.publicProfile || {};
  return json({
    ok: true,
    profile: {
      on: pp.on === true,
      name: clean(pp.name || a.worker.name, 60),
      city: clean(pp.city || a.worker.city, 40),
      bio: clean(pp.bio, 180),
      photo: isImg(pp.photo) ? pp.photo : '',
    },
    // What the public page will do with it (words, not code).
    note: 'The team page shows: photo (optional), name, city, your level and your delivered-order count. Never your CNIC, phone, address or earnings.',
  });
}

export async function POST(req) {
  const closed = await denyIf('workers');
  if (closed) return closed;
  const a = await verifyWorker(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'Invalid request' }, 400); }

  const on = b.on === true;
  const name = clean(b.name || a.worker.name, 60);
  const city = clean(b.city || a.worker.city, 40);
  const bio = clean(b.bio, 180);
  const photo = isImg(b.photo) ? String(b.photo).slice(0, 500) : '';
  if (on && name.length < 2) return json({ ok: false, error: 'Please write the name you want on the team page (at least 2 letters).' }, 400);

  await adminDb().collection('workers').doc(a.uid).set({
    publicProfile: { on, name, city, bio, photo, updatedAtMs: Date.now() },
  }, { merge: true });
  return json({ ok: true, on, name, city, bio, photo, message: on ? `Your profile is live on the team page: ${name}${city ? ` · ${city}` : ''}.` : 'Your profile is hidden again. Nothing of yours is on the team page now.' });
}
