import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { xtreamTest, xtreamImport } from '@/lib/xtreamServer';
import { cleanXtreamCreds, maskXtream } from '@/lib/xtream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Admin only. XTREAM CODES import (Admin > Live TV > "Connect an Xtream Codes panel").
//   POST { action: 'test',  server, username, password }
//        -> who the account is + how many channels and which groups are on it
//   POST { action: 'import', server, username, password, what, categories, hls }
//        -> the channels themselves. NOTHING is saved here: the admin reviews, then presses Save.
//
// The password is used for this one request and is never stored, never logged and never sent
// back. The channel links the shop keeps do contain it, exactly like every IPTV app does -
// that is how the Xtream protocol works, and it is why the panel is entered by the admin only.
const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }

  const creds = cleanXtreamCreds(b);
  if (!creds.ok) return json({ ok: false, error: creds.error }, 400);
  const action = String(b.action || 'test') === 'import' ? 'import' : 'test';

  try {
    if (action === 'test') {
      const r = await xtreamTest(b);
      if (!r.ok) return json({ ok: false, error: r.error, expired: r.expired, creds: maskXtream(creds) }, 502);
      return json({
        ok: true,
        creds: maskXtream(creds),
        account: r.account,
        counts: r.counts,
        groups: r.groups,
      });
    }

    const r = await xtreamImport(b, {
      what: ['live', 'vod', 'series'].includes(b.what) ? b.what : 'live',
      categories: Array.isArray(b.categories) ? b.categories.map(String).slice(0, 200) : [],
      hls: b.hls !== false,
    });
    if (!r.ok) return json({ ok: false, error: r.error }, 502);
    return json({
      ok: true,
      creds: maskXtream(creds),
      kind: r.kind,
      channels: r.channels,
      account: r.account,
      count: r.channels.length,
    });
  } catch (e) {
    // never echo the address+credentials back with an error
    console.error('xtream import failed:', e.message);
    return json({ ok: false, error: 'Could not reach the panel. Check the server address, username and password, then try again.' }, 502);
  }
}
