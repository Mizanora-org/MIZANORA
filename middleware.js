import { NextResponse } from 'next/server';
import { blockedIp, logSecurityEvent, securityIp, securityReady } from './lib/securityControl.js';

// Next 15.5 Node middleware can query private RTDB without exposing its key in an Edge bundle.
// A short per-instance blocklist cache means ordinary requests do NOT read Firebase per visit.
//
// v60 — MIDDLEWARE IS NOT FREE EITHER.
// Every request that runs middleware becomes a Function invocation, and whatever the middleware
// answers has to come from the origin instead of the CDN cache: Vercel counts that as
// "Fast Origin Transfer". With a matcher of "everything except _next/icons/img", the middleware ran
// for every product photo, every song, every sitemap chunk and every page — including the ones the
// CDN could have answered on its own. Combined with the photo and stream relays that is how the
// Hobby team crossed its fair-use limit on 2026-11-08 and got paused for 30 days.
//
// So the matcher now asks for the few things a blocklist actually protects: pages and APIs a person
// can act on. Static assets and file extensions are skipped by the matcher itself instead of being
// filtered inside the function (a skipped request costs nothing), and the blocklist answer is cached
// per instance for longer, so one preview tab cannot cause one database read per request.
export const runtime = 'nodejs';
export const config = {
  matcher: [
    // Pages, APIs and anything without a file extension. _next, images, icons and known file
    // types are excluded up front so the CDN keeps serving them without a Function in the path.
    '/((?!_next/|icons/|img/|brand/|fonts/|_vercel/|favicon\\.ico|apple-icon\\.png|icon\\.png|sw\\.js|service-worker\\.js|manifest\\.webmanifest|robots\\.txt|ads\\.txt).*)',
  ],
};

const staticPath = /\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?|css|js|mjs|map|txt|xml|json|mp3|m4a|mp4|webm|wav|pdf|zip|rar)$/i;
const probe = /(?:^|\/)(?:\.env(?:\.|\/|$)|\.git(?:\/|$)|wp-admin(?:\/|$)|wp-login\.php$|phpmyadmin(?:\/|$)|cgi-bin(?:\/|$)|actuator(?:\/|$)|server-status$)/i;

export async function middleware(req) {
  const pathname = req.nextUrl.pathname;
  // Static files never need the blocklist: they are cache hits at the edge and carry no user action.
  if (!pathname.startsWith('/api/') && staticPath.test(pathname)) return NextResponse.next();
  if (probe.test(pathname)) {
    await logSecurityEvent(req, 'probe-sensitive-path', { reason: 'sensitive-route', severity: 'high' });
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  // Keep the recovery screen and its verified-admin API reachable when an owner has been
  // accidentally blocked from an IP. Everything else, including costly APIs, is checked.
  if (pathname === '/admin/security' || pathname === '/api/admin/security' || pathname === '/api/admin/auth') return NextResponse.next();
  if (!securityReady()) return NextResponse.next();
  const ip = securityIp(req.headers);
  if (!ip) return NextResponse.next();
  const blocked = await blockedIp(ip);
  if (blocked) return new Response('Access blocked by the site administrator.', {
    status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store' },
  });
  return NextResponse.next();
}
