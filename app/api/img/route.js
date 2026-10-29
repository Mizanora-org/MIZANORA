import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

// IMAGE RELAY (v32) - the last-resort loader for product photos, banners and ad images.
//
// Why it exists: a supplier CDN that blocks hotlinking, an expired signature, a
// WhatsApp/Facebook image host that refuses a foreign Referer, or an old http
// link makes the BROWSER fail while the file itself is perfectly fine. When that
// happens the shop's components (CardMedia, CardPhoto, SafeImg, the ads script)
// ask this route for the same picture; the server fetches it and streams it back
// from the shop's own address, so the visitor always sees an image.
//
// Safety:
//  * https only, no private/local addresses (no SSRF into the network),
//  * the answer MUST be an image (text/HTML/JSON is refused),
//  * hard 8 MB cap and 10 s timeout,
//  * optional allow-list: set NEXT_IMAGE_PROXY_HOSTS="a.com,b.com" to restrict it.
//
// GET /api/img?u=https%3A%2F%2F...%2Fphoto.jpg
const MAX_BYTES = 8 * 1024 * 1024;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

function privateHost(host) {
  const h = String(host || '').toLowerCase();
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === '::1' || h.startsWith('[')) return true;
  return false;
}

function safeUrl(raw) {
  let x;
  try { x = new URL(String(raw || '').trim()); } catch { return null; }
  if (x.protocol !== 'https:') return null;
  if (privateHost(x.hostname)) return null;
  // Optional allow-list (host or *.host).
  const list = String(process.env.NEXT_IMAGE_PROXY_HOSTS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (list.length) {
    const host = x.hostname.toLowerCase();
    const ok = list.some((d) => (d.startsWith('*.') ? host.endsWith(d.slice(1)) : host === d || host.endsWith(`.${d}`)));
    if (!ok) return null;
  }
  return x;
}

const noCache = { 'Cache-Control': 'no-store' };

export async function GET(req) {
  const target = safeUrl(req.nextUrl.searchParams.get('u'));
  if (!target) return new NextResponse('bad image link', { status: 400, headers: noCache });

  let res;
  try {
    res = await fetch(target.toString(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': UA,
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        // Many CDNs answer only when the Referer looks like their own site.
        Referer: `${target.origin}/`,
      },
    });
  } catch {
    return new NextResponse('image host not reachable', { status: 504, headers: noCache });
  }

  if (!res.ok) return new NextResponse(`image host said ${res.status}`, { status: 502, headers: noCache });
  // A redirect could have landed on a private address: check the final URL too.
  if (!safeUrl(res.url)) return new NextResponse('bad redirect', { status: 400, headers: noCache });

  const type = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!type.startsWith('image/')) return new NextResponse('not an image', { status: 415, headers: noCache });
  const len = Number(res.headers.get('content-length') || 0);
  if (len > MAX_BYTES) return new NextResponse('image too large', { status: 413, headers: noCache });

  let buf;
  try { buf = Buffer.from(await res.arrayBuffer()); } catch { return new NextResponse('image download failed', { status: 502, headers: noCache }); }
  if (!buf.length) return new NextResponse('empty image', { status: 502, headers: noCache });
  if (buf.length > MAX_BYTES) return new NextResponse('image too large', { status: 413, headers: noCache });

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Content-Length': String(buf.length),
      // The relayed picture rarely changes: browsers and the CDN keep it a month.
      'Cache-Control': 'public, max-age=2592000, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
      'Access-Control-Allow-Origin': '*',
      'X-Image-Relay': '1',
    },
  });
}
