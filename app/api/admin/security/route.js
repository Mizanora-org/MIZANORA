import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { securityIp, securityReport, setBlockedIp, unblockIp } from '@/lib/securityControl';
import { readLimitedJson } from '@/lib/readLimitedJson';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (value, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });

// This endpoint intentionally stays reachable even from a blocked IP so a verified owner can
// recover access. Every action still requires a verified Firebase admin identity.
export async function POST(req) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
  let body = {};
  try { body = await readLimitedJson(req, 4096); } catch { return json({ ok: false, error: 'Invalid or oversized request.' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ ok: false, error: 'Invalid request.' }, 400);
  try {
    if (!body.action || body.action === 'list') return json(await securityReport(body.days));
    if (body.action === 'block') {
      if (String(body.ip || '').toLowerCase() === securityIp(req.headers)) return json({ ok: false, error: 'This is your current IP; do not lock yourself out.' }, 409);
      const entry = await setBlockedIp(body.ip, { reason: body.reason, hours: body.hours, by: auth.uid });
      return json({ ok: true, blocked: entry });
    }
    if (body.action === 'unblock') {
      await unblockIp(body.ip);
      return json({ ok: true });
    }
    return json({ ok: false, error: 'Unknown action.' }, 400);
  } catch (e) {
    // Do not return Firebase internals or credentials to the browser.
    const known = /^(?:Enter a valid|Invalid IP|Blocklist is full|Private Realtime Database)/.test(e.message || '');
    return json({ ok: false, error: known ? e.message : 'Security data is temporarily unavailable.' }, known ? 400 : 503);
  }
}
