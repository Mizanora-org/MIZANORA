// Mizanora v62 — ZERO-ORIGIN BEACON BUDGET.
//
// Why this file exists
// --------------------
// A public page view used to start THREE separate Vercel Functions:
//   * middleware (every request),
//   * /api/telemetry  (one POST per page + one heartbeat every 60 s per open tab),
//   * /api/analytics/collect (one POST per page),
// plus /api/ads/embed.js on pages with ad slots. Those are O(visitors) costs: at 100k visits a day
// that is ~500k Function invocations a day, i.e. the Hobby 1M/month allowance in two days, and every
// 204 the Function answers is also "Fast Origin Transfer".
//
// The fix is NOT to delete analytics (Admin > Traffic, /stats and live users all stay). It is to make
// the analytics a *sample*: a deterministic 1% of visitor ids send beacons, and the server scales
// each recorded hit back up by the sample weight. That is how real analytics products survive huge
// traffic. Sampling is stable (hash of the visitor id), so one visitor is either always in or always
// out — no flickering numbers, and no per-page coin flip.
//
//   NEXT_PUBLIC_TRACK_SAMPLE=1     exact counts, one beacon per page (small sites / debugging)
//   NEXT_PUBLIC_TRACK_SAMPLE=0.01  default, ~1% of visitors, counters scaled x100 (Hobby safe)
//   NEXT_PUBLIC_TRACK_SAMPLE=0     no beacons at all — literally zero Function calls from tracking
//
// A per-session cap stops one long-lived tab (or a SPA navigation loop) from sending hundreds of
// beacons. Nothing here touches a page's HTML: all of it runs in the browser, after paint.
//
// This module is imported by both client components and server route handlers, so EVERY browser
// global is behind a `typeof window` guard and nothing runs at import time except pure constants.

function sampleFromEnv() {
  const raw = process.env.NEXT_PUBLIC_TRACK_SAMPLE;
  if (raw === undefined || raw === null || String(raw).trim() === '') return 0.01;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0.01;
  return Math.min(1, Math.max(0, n));
}

/** Fraction of visitors that are allowed to send any beacon. */
export const SAMPLE_RATE = sampleFromEnv();

/** How much one sampled hit is worth. 0 means tracking is completely off. */
export const BEACON_WEIGHT = SAMPLE_RATE > 0 ? Math.max(1, Math.round(1 / SAMPLE_RATE)) : 0;

/** Hard cap per browser tab, per kind. A 10-minute tab can never cost 10 minutes of Functions. */
export const BEACON_CAPS = { page: 4, event: 8, heartbeat: 6, geo: 1 };

/** The same visitor id used by lib/track.js. Stable across pages and visits (localStorage). */
export function visitorId() {
  if (typeof window === 'undefined') return 'server';
  try {
    let v = window.localStorage.getItem('mz_vid');
    if (!v) {
      v = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6);
      window.localStorage.setItem('mz_vid', v.slice(0, 20));
    }
    return v;
  } catch (_) { return 'anon' + Math.random().toString(36).slice(2, 10); }
}

function hash(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function optedOut() {
  if (typeof window === 'undefined') return true;
  try { if (window.localStorage.getItem('mz_notrack')) return true; } catch (_) { /* private mode */ }
  try { if (window.navigator.doNotTrack === '1') return true; } catch (_) { /* ignore */ }
  try {
    const ua = window.navigator.userAgent || '';
    if (window.navigator.webdriver || /bot|crawl|spider|slurp|lighthouse|headless|preview|facebookexternalhit/i.test(ua)) return true;
  } catch (_) { /* ignore */ }
  return false;
}

/** Is this visitor one of the sampled ones? Pure and stable for a given visitor id. */
export function beaconSelected() {
  if (SAMPLE_RATE <= 0 || BEACON_WEIGHT <= 0) return false;
  if (optedOut()) return false;
  if (SAMPLE_RATE >= 1) return true;
  return hash(visitorId()) % 10000 < Math.round(SAMPLE_RATE * 10000);
}

/**
 * Claim one beacon of `kind`.
 * @returns {number} the sample weight to record (0 = do NOT send anything).
 */
export function takeBeacon(kind) {
  if (typeof window === 'undefined' || !beaconSelected()) return 0;
  const cap = BEACON_CAPS[kind] || 1;
  try {
    const key = `mz_bc_${kind}`;
    const used = Number(window.sessionStorage.getItem(key) || 0);
    if (used >= cap) return 0;
    window.sessionStorage.setItem(key, String(used + 1));
    return BEACON_WEIGHT;
  } catch (_) { return 0; } // storage blocked: tracking must never throw or fall back to 100% traffic
}

/** The weight the SERVER must apply to a sampled hit. Client payloads are never trusted for this. */
export function serverWeight() {
  return BEACON_WEIGHT > 0 ? BEACON_WEIGHT : 1;
}
