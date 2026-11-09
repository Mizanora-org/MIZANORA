import { NextResponse } from 'next/server';
import { publicUrl, safePublicFetch } from '@/lib/safeFetch';
import { securityIp, logSecurityEvent } from '@/lib/securityControl';
import { limitRequest } from '@/lib/requestRate';

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

const allowedHosts = () => String(process.env.NEXT_IMAGE_PROXY_HOSTS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
const safeUrl = (raw) => {
  try { return publicUrl(raw, { httpsOnly: true, hosts: allowedHosts().length ? allowedHosts() : null }); } catch { return null; }
};

const noCache = { 'Cache-Control': 'no-store' };

export async function GET(req) {
  const target = safeUrl(req.nextUrl.searchParams.get('u'));
  if (!target) {
    await logSecurityEvent(req, 'image-relay-invalid', { reason: 'bad-target', severity: 'medium' });
    return new NextResponse('bad image link', { status: 400, headers: noCache });
  }
  const rate = limitRequest('image-relay', securityIp(req.headers), 90);
  if (!rate.allowed) {
    await logSecurityEvent(req, 'rate-limit', { reason: 'image-relay', severity: 'high' });
    return new NextResponse('Too many image requests', { status: 429, headers: { ...noCache, 'Retry-After': String(rate.retryAfter) } });
  }

  let res;
  try {
    ({ res } = await safePublicFetch(target.href, {
      httpsOnly: true, hosts: allowedHosts().length ? allowedHosts() : null, timeout: 10000,
      headers: {
        'User-Agent': UA,
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: `${target.origin}/`,
      },
    }));
  } catch (e) {
    if (/private address|bad protocol|bad public URL|host not allowed/i.test(String(e.message || e))) {
      await logSecurityEvent(req, 'image-relay-invalid', { reason: 'blocked-redirect', severity: 'high' });
    }
    return new NextResponse('image host not reachable or redirect blocked', { status: 502, headers: noCache });
  }
  if (!res.ok) { try { await res.body?.cancel(); } catch { /* ignore */ } return new NextResponse(`image host said ${res.status}`, { status: 502, headers: noCache }); }

  const type = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!type.startsWith('image/')) { try { await res.body?.cancel(); } catch { /* ignore */ } return new NextResponse('not an image', { status: 415, headers: noCache }); }
  // v60: cap on the UPSTREAM HEADER, so an oversized file is refused before a single byte is pulled.
  const length = Number(res.headers.get('content-length')) || 0;
  if (length > MAX_BYTES) { try { await res.body?.cancel(); } catch { /* ignore */ } return new NextResponse('image too large', { status: 413, headers: noCache }); }

  return new NextResponse(res.body, {
    status: 200,
    headers: {
      'Content-Type': type,
      ...(length ? { 'Content-Length': String(length) } : {}),
      // v60: THE EDGE MUST KEEP THIS.
      // `s-maxage` is what makes Vercel's CDN cache a Function response. Without it every
      // repeat view of a relayed photo is a fresh Function run + a fresh origin transfer -
      // that is exactly how the Hobby Fast Origin Transfer limit was crossed on 2026-11-08.
      // With it, one relayed picture costs one transfer, not thousands.
      'Cache-Control': 'public, max-age=2592000, s-maxage=31536000, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
      'Access-Control-Allow-Origin': '*',
      'X-Image-Relay': '1',
    },
  });
}
