import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { fetchPublic } from '@/lib/tvProxy';
import { channelTarget } from '@/lib/liveTv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Admin only. POST { urls: [up to 12 stream links] } -> { results: [{ url, ok, ms, reason }] }.
// Each stream is asked for its playlist (6 second limit, all at once). "ok" means the server answered with a real playlist / media.
// This runs from the Vercel server: a stream that only works inside Pakistan can look dead here, so the admin page SWITCHES OFF (not deletes).
const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

async function probe(url) {
  const t = channelTarget(url);
  if (!t) return { url, ok: false, reason: 'bad link' };
  if (t.kind === 'youtube') return { url, ok: true, ms: 0, reason: 'youtube (not checked)' };
  const t0 = Date.now();
  try {
    const { res } = await fetchPublic(url, { timeout: 6000, headers: t.kind === 'hls' ? {} : { Range: 'bytes=0-1023' } });
    const ms = Date.now() - t0;
    if (!res.ok && res.status !== 206) { try { res.body && res.body.cancel(); } catch { /* ignore */ } return { url, ok: false, ms, reason: `HTTP ${res.status}` }; }
    const type = res.headers.get('content-type') || '';
    if (/text\/html/i.test(type)) { try { res.body && res.body.cancel(); } catch { /* ignore */ } return { url, ok: false, ms, reason: 'web page, not a stream' }; }
    if (t.kind === 'hls') {
      const reader = res.body.getReader(); const { value } = await reader.read(); try { await reader.cancel(); } catch { /* ignore */ }
      const head = Buffer.from(value || []).toString('utf8', 0, 400);
      return /^#EXTM3U/.test(head.trimStart()) ? { url, ok: true, ms } : { url, ok: false, ms, reason: 'not a playlist' };
    }
    try { res.body && res.body.cancel(); } catch { /* ignore */ }
    return { url, ok: true, ms };
  } catch (e) { return { url, ok: false, ms: Date.now() - t0, reason: /abort|timeout/i.test(String(e && e.name + e.message)) ? 'too slow (6s)' : 'unreachable' }; }
}

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  const urls = (Array.isArray(b.urls) ? b.urls : []).map((u) => String(u || '').trim()).filter((u) => /^https?:\/\//i.test(u)).slice(0, 12);
  if (!urls.length) return json({ ok: false, error: 'No links' }, 400);
  return json({ ok: true, results: await Promise.all(urls.map(probe)) });
}
