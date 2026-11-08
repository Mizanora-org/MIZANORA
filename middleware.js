import { NextResponse } from 'next/server';
import { blockedIp, logSecurityEvent, securityIp, securityReady } from './lib/securityControl.js';

// Next 15.5 Node middleware can query private RTDB without exposing its key in an Edge bundle.
// A short per-instance blocklist cache means ordinary requests do NOT read Firebase per visit.
export const runtime = 'nodejs';
export const config = {
  matcher: ['/((?!_next/|icons/|img/|favicon.ico|apple-icon.png|icon.png|sw.js|service-worker.js).*)'],
};
const staticPath = /\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?|css|js|map|txt|xml|mp3|mp4|pdf)$/i;
const probe = /(?:^|\/)(?:\.env(?:\.|\/|$)|\.git(?:\/|$)|wp-admin(?:\/|$)|wp-login\.php$|phpmyadmin(?:\/|$)|cgi-bin(?:\/|$)|actuator(?:\/|$)|server-status$)/i;

export async function middleware(req) {
  const pathname = req.nextUrl.pathname;
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
