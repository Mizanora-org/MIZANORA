import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { findWorkerByCode } from '@/lib/workerAuth';
import { cleanWorkerCode } from '@/lib/workers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const seen = new Map();

// Counts one visit per visitor per link (the browser sends it once per session). Only for the worker's own "visits" number.
export async function POST(req) {
  if (!adminReady()) return NextResponse.json({ ok: false });
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  let code = ''; try { code = cleanWorkerCode((await req.json()).code); } catch { /* ignore */ }
  if (!code) return NextResponse.json({ ok: false });
  const k = `${ip}:${code}`, now = Date.now();
  if (now - (seen.get(k) || 0) < 30 * 60 * 1000) return NextResponse.json({ ok: true });
  seen.set(k, now); if (seen.size > 5000) seen.clear();
  try {
    const db = adminDb(); const w = await findWorkerByCode(db, code);
    if (w) await db.collection('workers').doc(w.id).set({ stats: { clicks: FieldValue.increment(1) } }, { merge: true });
  } catch { /* never block the shop */ }
  return NextResponse.json({ ok: true });
}
