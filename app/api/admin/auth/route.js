import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The admin gate checks a *verified* Firebase identity instead of reading an orders collection.
// No Firestore read, including on a cold session or when Firestore's daily quota is exhausted.
export async function GET(req) {
  const a = await verifyAdmin(req);
  return NextResponse.json(a.ok ? { ok: true, uid: a.uid, via: a.via } : { ok: false, error: a.error },
    { status: a.ok ? 200 : a.status, headers: { 'Cache-Control': 'private, no-store' } });
}
