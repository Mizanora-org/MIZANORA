import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { adminRtdb } from '@/lib/firebase-admin';
import { bump, dayKey, hourKey, rtdbOn } from '@/lib/rtdb';
import { pageKey } from '@/lib/track';
import { limitRequest } from '@/lib/requestRate';
import { readLimitedJson } from '@/lib/readLimitedJson';
import { logSecurityEvent, securityIp } from '@/lib/securityControl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// No public RTDB writes: a browser sends ONE small, validated page/event/heartbeat message
// instead of 5-9 unauthenticated database writes. Neither clients nor this endpoint can pick
// arbitrary database paths or metric names. The IP is used only for rate limiting / deriving a
// PRIVATE presence key, never written as plain text to analytics.
const json = (b, status = 400) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } });
const devices = new Set(['mobile', 'tablet', 'desktop']);
const sources = new Set(['direct', 'search', 'social', 'facebook', 'instagram', 'tiktok', 'whatsapp', 'youtube', 'campaign', 'other']);
const eventKinds = new Set(['pv', 'cart', 'ev', 'q', 'q0']);
const eventActions = new Set(['view', 'cart', 'checkout', 'wa', 'wish']);
const seen = new Map();

function keyFor(ip, vid) {
  // The Admin service key is a fallback when a separate server-only telemetry key isn't set.
  // No plain IP/visitor ID is ever saved to presence; rotate TELEMETRY_SECRET if desired.
  const secret = process.env.TELEMETRY_SECRET || process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_SERVICE_ACCOUNT || '';
  if (!secret) return '';
  return createHmac('sha256', secret).update(`${ip}|${vid}`).digest('hex').slice(0, 32);
}
const cleanPath = (value) => {
  const path = String(value || '/').split('?')[0].split('#')[0].slice(0, 120);
  return /^\/[a-z0-9\u0600-\u06ff/_~-]*$/i.test(path) ? path : '/';
};
const device = (v) => devices.has(v) ? v : 'desktop';
const source = (v) => sources.has(v) ? v : 'other';

export async function POST(req) {
  if (!rtdbOn()) return json({ ok: false, error: 'Tracking is unavailable.' }, 503);
  const origin = req.headers.get('origin');
  if (req.headers.get('sec-fetch-site') === 'cross-site' || (origin && (() => { try { return new URL(origin).host !== new URL(req.url).host; } catch { return true; } })())) {
    return json({ ok: false, error: 'Cross-site tracking is not allowed.' }, 403);
  }
  const ip = securityIp(req.headers);
  // With no trusted proxy address, reject instead of lumping all visitors into the same
  // "unknown" key or accepting a client-spoofed x-forwarded-for header.
  if (!ip) return json({ ok: false, error: 'Trusted visitor address unavailable.' }, 503);
  if (!limitRequest('telemetry-ip', ip, 80, 60_000).allowed) {
    void logSecurityEvent(req, 'rate-limit', { reason: 'telemetry', severity: 'medium' });
    return json({ ok: false, error: 'Too many tracking requests.' }, 429);
  }
  let b;
  try { b = await readLimitedJson(req, 2048); } catch { return json({ ok: false, error: 'Invalid or oversized tracking payload.' }); }
  if (!b || typeof b !== 'object' || !['page', 'event', 'heartbeat'].includes(b.type)
    || !/^[a-z0-9]{8,24}$/.test(String(b.vid || ''))) return json({ ok: false, error: 'Invalid tracking payload.' });
  if (!limitRequest('telemetry-visitor', `${ip}/${b.vid}`, 40, 60_000).allowed) return json({ ok: false, error: 'Tracking slowed down.' }, 429);
  const now = Date.now();
  const day = dayKey(now);
  const presenceId = keyFor(ip, b.vid);
  if (!presenceId) return json({ ok: false, error: 'Tracking key unavailable.' }, 503);
  const visitor = `${presenceId}/${day}`;
  try {
    if (b.type === 'page') {
      const path = cleanPath(b.path);
      const entries = [
        [`d/${day}/views`, 1], [`h/${hourKey(now)}/v`, 1],
        [`hr/${day}/${hourKey(now).slice(11)}`, 1], [`pg/${day}/${pageKey(path)}`, 1],
      ];
      // This cache caps daily "unique" and new/returning metrics per visitor and per worker.
      // It is approximate across serverless instances; a public analytics endpoint is NOT a
      // billing-grade unique-visitor counter. RTDB counters are private and rate-limited.
      if (b.newDay === true && !seen.has(visitor)) {
        entries.push([`d/${day}/uv`, 1], [`dev/${day}/${device(b.device)}`, 1], [`src/${day}/${source(b.source)}`, 1], [`rt/${day}/${b.isNew === true ? 'new' : 'back'}`, 1]);
        seen.set(visitor, now);
        if (seen.size > 30000) seen.clear();
      }
      await bump(entries);
      await adminRtdb().ref(`presence/${presenceId}`).set({ t: now, p: path, d: device(b.device).slice(0, 1) });
    } else if (b.type === 'heartbeat') {
      await adminRtdb().ref(`presence/${presenceId}`).set({ t: now, p: cleanPath(b.path), d: device(b.device).slice(0, 1) });
    } else {
      if (!eventKinds.has(b.kind)) return json({ ok: false, error: 'Unknown event.' });
      const key = b.kind === 'ev' ? String(b.key || '').toLowerCase() : String(b.key || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff_-]/g, '_').slice(0, 60);
      if (!key || (b.kind === 'ev' && !eventActions.has(key))) return json({ ok: false, error: 'Invalid event key.' });
      const entries = [[`${b.kind}/${day}/${key}`, 1]];
      if (b.kind === 'pv') entries.push([`ev/${day}/view`, 1]);
      if (b.kind === 'cart') entries.push([`ev/${day}/cart`, 1]);
      await bump(entries);
    }
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('telemetry failed:', e.message);
    return json({ ok: false, error: 'Tracking is temporarily unavailable.' }, 503);
  }
}
