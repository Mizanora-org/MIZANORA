import { NextResponse } from 'next/server';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { findWorkerByCode } from '@/lib/workerAuth';
import { cleanWorkerCode, effectiveTier } from '@/lib/workers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Tells the shop whether a ref code is valid and (for Elite workers) which own prices to show. Nothing private is returned.
export async function GET(req) {
  const code = cleanWorkerCode(new URL(req.url).searchParams.get('code'));
  if (!code || !adminReady()) return NextResponse.json({ ok: false });
  try {
    const w = await findWorkerByCode(adminDb(), code);
    if (!w) return NextResponse.json({ ok: false, invalid: true });
    return NextResponse.json({ ok: true, markups: effectiveTier(w).custom ? w.markups || {} : {} }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch { return NextResponse.json({ ok: false }); }
}
