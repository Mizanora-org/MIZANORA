// VISITOR TRACKING in the browser, written straight into the Firebase REALTIME DATABASE (a second free database with its own quota).
// It never touches Firestore, so tracking can not use up the Firestore limits. Only small counters are stored: no names, no phone numbers.
// Rules (database.rules.json) only allow "+1" on counters, and the admin reads them in Admin > Dashboard.
const BASE = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com` : '')).replace(/\/+$/, '');

const pk = (t = Date.now()) => new Date(t + 5 * 3600e3).toISOString(); // Pakistan clock (UTC+5)
const dayKey = () => pk().slice(0, 10);
const hourKey = () => pk().slice(0, 13);
const safe = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);

let dead = false;       // the database is not set up / refused: stop trying for this visit
let failures = 0;
const put = (path, body) => {
  if (!BASE || dead) return;
  try {
    fetch(`${BASE}/${path}.json`, { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) })
      .then((r) => { if (!r.ok && ++failures >= 3) dead = true; }).catch(() => { if (++failures >= 3) dead = true; });
  } catch (_) { /* tracking must never break the shop */ }
};
const inc = (path) => put(`stats/${path}`, { '.sv': { increment: 1 } });

export const isTracked = () => {
  if (typeof window === 'undefined' || !BASE) return false;
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
    const u = (q.get('utm_source') || q.get('ref') || '').toLowerCase();
    if (u) return safe(u).slice(0, 20) || 'campaign';
    const r = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : '';
    if (!r || r === location.hostname) return 'direct';
    if (/google|bing|duckduckgo|yahoo/.test(r)) return 'search';
    if (/facebook|fb\.|instagram|tiktok|whatsapp|wa\.me|youtube|snapchat|twitter|t\.co/.test(r)) return safe(r.split('.')[0]) || 'social';
    return 'other';
  } catch (_) { return 'direct'; }
};

let lastPath = '';
// v37: WHICH pages people read. `pg` is a counter per path per day, so Admin > Dashboard can show
// a real "top pages" list instead of only "who is on the site right now". Paths are made safe
// first (RTDB keys cannot hold . $ # [ ] /) and the query string is dropped, so
// /search?q=shoes and /search?q=boots count as one page: /search.
export const pageKey = (path) =>
  String(path || '/')
    .split('?')[0]
    .split('#')[0]
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, 60) || 'home';

// One page view. Counts views, visitors (once a day), the hour, the page itself, and the first
// page of a visit's source, device and "new or returning".
/**
 * The other half of pageKey(): turn an internal page key back into the path a person would
 * type. `home` -> "/", `blog_hello_world` -> "/blog/hello-world". Used by /api/stats and by
 * the dashboard's "most read pages" list, which is why it lives here and not in either one.
 */
export const pageLabel = (key) => (String(key || '') === 'home' ? '/' : `/${String(key || '').replace(/_/g, '/')}`);

export function trackPage(path) {
  if (!isTracked() || path === lastPath) return;
  lastPath = path;
  const d = dayKey();
  inc(`d/${d}/views`);
  inc(`h/${hourKey()}/v`);
  // v38: the hour of THIS day, so the dashboard can show a real "busy hours" curve over the
  // whole range. `h/` only remembers the last 24 separate hours and is swept by the cleaner,
  // which is why the old by-hour chart was flat zero: it was reading a shape nobody writes.
  inc(`hr/${d}/${hourKey().slice(11)}`);
  inc(`pg/${d}/${pageKey(path)}`);
  try {
    // new vs returning: a flag set on the very first visit, kept for a year
    let first = localStorage.getItem('mz_first');
    if (!first) { first = String(Date.now()); localStorage.setItem('mz_first', first); }
    const isNew = Date.now() - Number(first) < 60e3; // the same minute = this is their first page
    if (localStorage.getItem('mz_rt') !== d) {
      localStorage.setItem('mz_rt', d);
      inc(`rt/${d}/${isNew ? 'new' : 'back'}`);
    }
    if (localStorage.getItem('mz_uvday') !== d) { localStorage.setItem('mz_uvday', d); inc(`d/${d}/uv`); inc(`dev/${d}/${device()}`); inc(`src/${d}/${source()}`); }
  } catch (_) { /* ignore */ }
  heartbeat(path);
}

// "Who is on the site now": one small record per visitor, refreshed while the page is open. The admin counts the recent ones.
export function heartbeat(path) {
  if (!isTracked()) return;
  put(`presence/${visitorId()}`, { t: Date.now(), p: String(path || location.pathname).slice(0, 120), d: device().slice(0, 1) });
}

// Events. kind: 'pv' (product viewed, key = product slug), 'cart' (added to cart, key = slug), 'ev' (checkout / wa / wish), 'q' / 'q0' (search / search with no result)
export function trackEvent(kind, key) {
  if (!isTracked()) return;
  const k = kind === 'q' || kind === 'q0' ? safe(key) : String(key || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90);
  if (!k) return;
  inc(`${kind}/${dayKey()}/${k}`);
  if (kind === 'pv') inc(`ev/${dayKey()}/view`);
  if (kind === 'cart') inc(`ev/${dayKey()}/cart`);
}
