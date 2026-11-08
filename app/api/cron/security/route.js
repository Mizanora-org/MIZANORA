import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { pruneSecurityEvents } from '@/lib/securityControl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (value, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

// Vercel cron sets Authorization: Bearer $CRON_SECRET. Without that server-only secret the
// endpoint is unavailable. The event logger also prunes on the first event of each day.
export async function GET(req) {
  const configured = String(process.env.CRON_SECRET || '');
  const supplied = String(req.headers.get('authorization') || '');
  const expected = `Bearer ${configured}`;
  if (!configured || supplied.length !== expected.length
    || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return json({ ok: false }, 401);
  try { return json({ ok: true, removed: await pruneSecurityEvents() }); }
  catch (e) { console.error('security retention failed:', e.message); return json({ ok: false, error: 'Retention task failed.' }, 503); }
}
