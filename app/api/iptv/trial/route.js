import { NextResponse } from 'next/server';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { cleanTrial, cleanPhone, IPTV } from '@/lib/iptv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

// One request per number per 6 hours, and a small per-IP guard, so the form cannot be used to spam the shop.
const seen = new Map(); // phone -> time
const ipHits = new Map(); // ip -> [times]
const HOUR = 3600e3;

function ipLimited(ip) {
  const now = Date.now();
  const list = (ipHits.get(ip) || []).filter((t) => now - t < HOUR);
  list.push(now);
  ipHits.set(ip, list);
  if (ipHits.size > 2000) ipHits.clear();
  return list.length > 6;
}

// POST /api/iptv/trial — the public "free trial" form on /iptv/trial.
// Nothing is created here: the request goes to the admin queue (Admin > IPTV), and the team
// issues the line on WhatsApp. That keeps fake trials and card abuse at zero.
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'Bad request.' }, 400); }

  const v = cleanTrial(body);
  if (!v.ok) return json({ ok: false, error: v.error }, 400);
  if (!cleanPhone(v.data.phone)) return json({ ok: false, error: 'Sahi mobile number likhein (03XX-XXXXXXX).' }, 400);

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (ipLimited(ip)) return json({ ok: false, error: 'Bohat zyada requests. Thori der baad koshish karein.' }, 429);

  const last = seen.get(v.data.phone);
  if (last && Date.now() - last < 6 * HOUR) {
    return json({ ok: false, error: 'Is number se trial request pehle hi aa chuki hai. WhatsApp par batayein.' }, 409);
  }
  seen.set(v.data.phone, Date.now());
  if (seen.size > 5000) seen.clear();

  if (!adminReady()) {
    // The shop can still be deployed without a database: the visitor is told to use WhatsApp.
    return json({ ok: false, error: 'Online request filhal band hai — WhatsApp par "IPTV trial" likh kar bhejein.' }, 503);
  }

  try {
    await adminDb().collection('iptvTrials').add({
      ...v.data,
      status: 'new',
      trialHours: IPTV.trialHours,
      ip,
      createdAt: Date.now(),
    });
    return json({ ok: true, hours: IPTV.trialHours });
  } catch {
    return json({ ok: false, error: 'Request save nahi hui. WhatsApp par bhej dein.' }, 500);
  }
}
