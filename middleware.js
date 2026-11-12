import { NextResponse } from 'next/server';
import { blockedIp, logSecurityEvent, securityIp, securityReady } from './lib/securityControl.js';

// Next 15.5 Node middleware can query private RTDB without exposing its key in an Edge bundle.
// A short per-instance blocklist cache means ordinary requests do NOT read Firebase per visit.
//
// v60 scoped the matcher to "everything except static files" — but "everything" still meant EVERY
// public page view ran a Function AND (this is the expensive part) could not be answered straight
// from the CDN cache. At 100k visits/day that alone is 100k Function invocations and ~20 GB of
// "Fast Origin Transfer" from re-serving full HTML pages. v61 fixed ISR writes; it could not fix
// this, because the cost grows with traffic, not with the number of pages.
//
// v62 — AN ALLOWLIST, NOT A BLOCKLIST.
// Middleware now runs ONLY where a blocked IP could actually DO something: admin, account and
// state-changing endpoints. Public HTML, sitemaps, images, JS/CSS, fonts, audio, TV segments and
// read-only APIs never enter a Function at all — the Vercel CDN answers them. That is the difference
// between "one Function per visitor" and "zero Functions per visitor", which is what the Hobby
// free tier needs when lakhs of people arrive.
//
// The IP blocklist, the probe log and the recovery screen are all still here for those action
// routes. Read-only pages are public by definition; trying to block an IP from a CDN-cached copy of
// a product page would cost a Function on every request and still be bypassable.
export const runtime = 'nodejs';

// Defense in depth: if a future release widens the matcher, these must never reach the blocklist.
// (Keeping the check here also means a deployment with an older matcher stays safe.)
const ALWAYS_SKIP = new RegExp('^/(?:_next/|icons/|img/|brand/|fonts/|ads/|_vercel/)');

export const config = {
  // Every entry is a literal string, so Next can statically compile the matcher and Vercel can
  // skip the Function entirely for anything else. No catch-all '/:path*'.
  matcher: [
    // Known scanners: keep the security-event log for probes (the 404 itself is free, this is only
    // about recording the attempt). Normal visitors never match this.
    '/((?:\\.env|\\.git|wp-admin|wp-login\\.php|phpmyadmin|cgi-bin|actuator|server-status)(?:/.*)?)',

    // Owner-only screens and APIs.
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/account/:path*',

    // Endpoints where a visitor can change state, spend quota or send data.
    '/api/orders',
    '/api/track',
    '/api/coupon',
    '/api/assistant',
    '/api/assistant/tts',
    '/api/ai-search',
    '/api/upload',
    '/api/import-image',
    '/api/image-report',
    '/api/revalidate',
    '/api/search-log',
    '/api/telemetry',
    '/api/analytics/collect',
    '/api/ads/click',
    '/api/ads/impression',
    '/api/worker/:path*',
    '/api/live/cast-key',
    '/api/quran/state',
    '/api/movies/refresh',
    '/api/movies/servers',
    '/api/cron/:path*',
  ],
};

const staticPath = /\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?|css|js|mjs|map|txt|xml|json|mp3|m4a|mp4|webm|wav|pdf|zip|rar)$/i;
const probe = /(?:^|\/)(?:\.env(?:\.|\/|$)|\.git(?:\/|$)|wp-admin(?:\/|$)|wp-login\.php$|phpmyadmin(?:\/|$)|cgi-bin(?:\/|$)|actuator(?:\/|$)|server-status$)/i;

export async function middleware(req) {
  const pathname = req.nextUrl.pathname;
  // Static files never need the blocklist: they are cache hits at the edge and carry no user action.
  if (ALWAYS_SKIP.test(pathname) || (!pathname.startsWith('/api/') && staticPath.test(pathname))) return NextResponse.next();
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
