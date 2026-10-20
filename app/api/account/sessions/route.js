import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminApp, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

// SIGN OUT EVERYWHERE. The signed-in customer asks to end all of their login sessions. Their refresh tokens are revoked, so every
// other phone or browser is signed out the next time it renews its login (within about an hour); this device signs out at once.
export async function POST(req) {
  if (!adminReady()) return json({ ok: false, error: 'This needs the server key (FIREBASE_SERVICE_ACCOUNT) to be set up.' }, 503);
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ ok: false, error: 'Please sign in again.' }, 401);
  try {
    const auth = getAuth(adminApp());
    const dec = await auth.verifyIdToken(token);
    await auth.revokeRefreshTokens(dec.uid);
    return json({ ok: true });
  } catch (e) { return json({ ok: false, error: 'Could not end the sessions. Please sign in again and retry.' }, 401); }
}
