import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Mizanora v58 — the song CDN proxy (the reason music now actually plays).
//
// JioSaavn's CDN (aac.saavncdn.com / c.saavncdn.com) intermittently rate-limits or applies
// referer/hotlink checks to direct third-party embedding. Search results looked perfect while <audio>
// stayed silent and album art stayed blank. The reference site solved this with an /api/stream proxy;
// this is the same idea, host-locked:
//
//   GET /api/songs/cdn?url=https%3A%2F%2Faac.saavncdn.com%2F...
//
// Only saavncdn.com hosts are allowed — this is never a general-purpose open proxy. Range requests are
// forwarded, so seeking still works, and files are immutable so the edge keeps them.
//
// v39: hide the upstream URL from the query string in logs by accepting ?u= as well.

const ALLOWED = ['saavncdn.com', 'jiosaavn.com', 'saavn.com'];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

function allowedHost(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export async function GET(req) {
  const target = String(req.nextUrl.searchParams.get('url') || req.nextUrl.searchParams.get('u') || '').trim();
  if (!target || !allowedHost(target)) {
    return new NextResponse('bad or disallowed url', { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 25000) : null;
  const range = req.headers.get('range') || '';
  const ifRange = req.headers.get('if-range') || '';

  try {
    const upstream = await fetch(target, {
      ...(ctrl ? { signal: ctrl.signal } : {}),
      headers: {
        'user-agent': UA,
        accept: '*/*',
        ...(range ? { range } : {}),
        ...(ifRange ? { 'if-range': ifRange } : {}),
      },
      redirect: 'follow',
    });

    if (!upstream || (!upstream.ok && upstream.status !== 206)) {
      return new NextResponse(`upstream ${upstream ? upstream.status : 'error'}`, {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const headers = new Headers();
    ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified'].forEach((h) => {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    });
    if (!headers.get('accept-ranges')) headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=604800, s-maxage=86400, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch {
    return new NextResponse('upstream fetch failed', { status: 502, headers: { 'Cache-Control': 'no-store' } });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
