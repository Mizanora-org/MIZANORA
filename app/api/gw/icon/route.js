import { openUrl, clientIp, rateLimit } from '@/lib/gateway/security';
import { fetchPublic } from '@/lib/tvProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

// Channel logo proxy: /api/gw/icon?t=<sealed>
// Logo ka asli host bhi chhupa rehta hai; 1 din cache.
export async function GET(req) {
  const token = new URL(req.url).searchParams.get('t') || '';
  if (!rateLimit(clientIp(req), 'gw-icon', 400, 60_000)) return new Response('', { status: 429 });
  const target = openUrl(token);
  if (!target || !/^https?:\/\//i.test(target)) return new Response('', { status: 404 });

  try {
    const { res } = await fetchPublic(target, { timeout: 8000 });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !/^image\//i.test(type)) {
      try { res.body && res.body.cancel(); } catch { /* ignore */ }
      return new Response('', { status: 404 });
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 400_000) return new Response('', { status: 413 });
    return new Response(buf, {
      status: 200,
      headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400, s-maxage=86400' },
    });
  } catch {
    return new Response('', { status: 404 });
  }
}
