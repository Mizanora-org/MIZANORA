import { NextResponse } from 'next/server';
import dns from 'node:dns/promises';
import net from 'node:net';
import { verifyAdmin } from '@/lib/adminAuth';
import { parseM3U } from '@/lib/liveTv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Admin only. POST { url } -> downloads an M3U playlist from a link (the browser cannot, most playlist servers refuse cross-site requests)
// and returns { channels, skipped }. Safety: https only, no private / local addresses (so this cannot be used to look inside the server's
// own network), 2 MB at most, 15 seconds at most. Nothing is saved here: the admin reviews the list and presses Save.
const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });
const priv = (ip) => {
  if (net.isIPv4(ip)) { const [a, b] = ip.split('.').map(Number); return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224; }
  if (net.isIPv6(ip)) { const l = ip.toLowerCase(); return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:'); }
  return true;
};

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  let u; try { u = new URL(String(b.url || '').trim()); } catch { return json({ ok: false, error: 'This is not a link.' }, 400); }
  if (u.protocol !== 'https:') return json({ ok: false, error: 'Only https:// playlist links can be loaded here. For an http:// playlist, download it and upload the file instead.' }, 400);
  try {
    const addrs = net.isIP(u.hostname) ? [{ address: u.hostname }] : await dns.lookup(u.hostname, { all: true });
    if (!addrs.length || addrs.some((x) => priv(x.address))) return json({ ok: false, error: 'This address is not allowed.' }, 400);
  } catch { return json({ ok: false, error: 'This address could not be found.' }, 400); }
  try {
    const r = await fetch(u.href, { signal: AbortSignal.timeout(15000), redirect: 'error', headers: { Accept: '*/*', 'User-Agent': 'MizanoraTV/1.0' } });
    if (!r.ok) return json({ ok: false, error: `The playlist server answered ${r.status}.` }, 502);
    const reader = r.body.getReader(); const parts = []; let size = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 2 * 1024 * 1024) { try { await reader.cancel(); } catch { /* stop */ } return json({ ok: false, error: 'The playlist is bigger than 2 MB. Split it or upload a smaller file.' }, 413); } parts.push(value); }
    const text = Buffer.concat(parts).toString('utf8');
    if (!/#EXTM3U|#EXTINF/i.test(text)) return json({ ok: false, error: 'This is not an M3U playlist (no #EXTINF lines).' }, 422);
    const out = parseM3U(text);
    return json({ ok: true, channels: out.channels, skipped: out.skipped });
  } catch (e) { return json({ ok: false, error: 'The playlist could not be loaded (it may redirect, be too slow or refuse the request). Download it and upload the file instead.' }, 502); }
}
