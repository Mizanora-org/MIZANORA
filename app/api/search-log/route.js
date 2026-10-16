import { NextResponse } from 'next/server';
import { denyIf } from '@/lib/siteGate';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const seen = new Map();

// Counts what shoppers search for. Only the words are saved (no IP, no account), so you can see what to stock.
export async function POST(req) {
  const closed = await denyIf();
  if (closed) return closed;
  if (!adminReady()) return new NextResponse(null, { status: 204 });
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  const now = Date.now();
  const a = (seen.get(ip) || []).filter((t) => now - t < 60000); a.push(now); seen.set(ip, a);
  if (seen.size > 4000) seen.clear();
  if (a.length > 20) return new NextResponse(null, { status: 204 });
  try {
    const b = await req.json();
    const q = String(b.q || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (q.length < 3) return new NextResponse(null, { status: 204 });
    const id = Buffer.from(q).toString('hex').slice(0, 120);
    const found = Boolean(b.found);
    await adminDb().collection('searchLogs').doc(id).set({
      q, count: FieldValue.increment(1), ...(found ? { found: FieldValue.increment(1) } : { missed: FieldValue.increment(1) }), lastMs: now,
    }, { merge: true });
  } catch (e) { /* analytics must never break the shop */ }
  return new NextResponse(null, { status: 204 });
}
