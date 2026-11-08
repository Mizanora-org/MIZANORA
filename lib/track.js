// Browser telemetry is best-effort and privacy-aware. The client never writes directly to
// Firebase; /api/telemetry validates and batches counters through the server-only Admin SDK.
const ENABLED = Boolean(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
const pk = (t = Date.now()) => new Date(t + 5 * 3600e3).toISOString();
const dayKey = () => pk().slice(0, 10);
const safe = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);

let dead = false;
let failures = 0;
const send = (payload) => {
  if (!ENABLED || dead) return;
  try {
    fetch('/api/telemetry', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vid: visitorId(), ...payload }) })
      .then((r) => { if (!r.ok && ++failures >= 3) dead = true; }).catch(() => { if (++failures >= 3) dead = true; });
  } catch (_) { /* tracking never interrupts the shop */ }
};

export const isTracked = () => {
  if (typeof window === 'undefined' || !ENABLED) return false;
  try { if (localStorage.getItem('mz_notrack')) return false; } catch (_) { /* ignore */ }
  const ua = navigator.userAgent || '';
  if (navigator.webdriver || /bot|crawl|spider|slurp|lighthouse|headless|preview|facebookexternalhit/i.test(ua)) return false;
  return true;
};

export function visitorId() {
  try {
    let v = localStorage.getItem('mz_vid');
    if (!v) { v = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6); localStorage.setItem('mz_vid', v.slice(0, 20)); }
    return v;
  } catch (_) { return 'anon' + Math.random().toString(36).slice(2, 10); }
}
const device = () => { const w = window.innerWidth; return w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop'; };
const source = () => {
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('utm_source') || q.has('ref')) return 'campaign';
    const r = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : '';
    if (!r || r === location.hostname) return 'direct';
    if (/google|bing|duckduckgo|yahoo/.test(r)) return 'search';
    if (/facebook|fb\.|instagram|tiktok|whatsapp|wa\.me|youtube/.test(r)) {
      for (const s of ['facebook', 'instagram', 'tiktok', 'whatsapp', 'youtube']) if (r.includes(s)) return s;
      return 'social';
    }
    return 'other';
  } catch (_) { return 'direct'; }
};

let lastPath = '';
export const pageKey = (path) =>
  String(path || '/').split('?')[0].split('#')[0].toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_').slice(0, 60) || 'home';
export const pageLabel = (key) => (String(key || '') === 'home' ? '/' : `/${String(key || '').replace(/_/g, '/')}`);

export function trackPage(path) {
  if (!isTracked() || path === lastPath) return;
  lastPath = path;
  const d = dayKey();
  let newDay = false, isNew = false;
  try {
    let first = localStorage.getItem('mz_first');
    if (!first) { first = String(Date.now()); localStorage.setItem('mz_first', first); }
    isNew = Date.now() - Number(first) < 60e3;
    newDay = localStorage.getItem('mz_uvday') !== d;
    if (newDay) localStorage.setItem('mz_uvday', d);
  } catch (_) { /* anonymous tracking is still best effort */ }
  send({ type: 'page', path, device: device(), source: source(), newDay, isNew });
}

// Presence is refreshed only while the document is visible (see components/Tracker.js).
export function heartbeat(path) {
  if (!isTracked()) return;
  send({ type: 'heartbeat', path: String(path || location.pathname), device: device() });
}

// Events: 'pv'/'cart' product, 'ev' checkout/wa/wish, 'q'/'q0' search.
export function trackEvent(kind, key) {
  if (!isTracked()) return;
  const k = kind === 'q' || kind === 'q0' ? safe(key) : String(key || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90);
  if (!k) return;
  send({ type: 'event', kind, key: k });
}
