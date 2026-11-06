// Mizanora v56 — first-party, server-side analytics.
//
// The shop already counts page views from the browser (lib/track.js → Realtime Database). What it
// could never answer was: *where* are the visitors, from which network, on what browser, and how far
// are we from 100,000 visits a day? Those facts are only visible on the server, because the country,
// city and IP are read from the request headers (Vercel sends x-vercel-ip-*, Cloudflare sends
// cf-*), not from JavaScript.
//
// So this module adds a second, complementary layer:
//
//   * `/api/analytics/collect` receives a tiny beacon per page view,
//   * the server derives country / region / city / timezone, browser / OS / device, referrer and a
//     masked IP, then increments compact counters in the Realtime Database (its own free quota, so
//     analytics can never eat the Firestore limit),
//   * `/admin/traffic` shows today, 7 days and 30 days, the 100k/day goal, the country and city
//     tables, the browser split, the referrers and the most recent visitors.
//
// Privacy: the full IP is **not** stored by default. We keep a masked IP (last octet zeroed) and a
// salted hash used only to count unique visitors. Set ANALYTICS_FULL_IP=1 if you truly need the raw
// address (for example to fight abuse), and say so in your privacy policy.
import crypto from 'node:crypto';
import { adminRtdb, rtdbUrl } from './firebase-admin';

const SALT = String(process.env.ANALYTICS_SALT || 'mizanora-analytics');
const FULL_IP = String(process.env.ANALYTICS_FULL_IP || '') === '1';

/** Pakistan day (UTC+5) — the shop's own clock, so "today" means today in Lahore. */
export function pkDay(offsetDays = 0) {
  const t = Date.now() + 5 * 3600e3 - offsetDays * 864e5;
  return new Date(t).toISOString().slice(0, 10);
}
export function pkHour() {
  return new Date(Date.now() + 5 * 3600e3).toISOString().slice(11, 13);
}
export const pkHourKey = (offsetHours = 0) => new Date(Date.now() + 5 * 3600e3 - offsetHours * 3600e3).toISOString().slice(0, 13);

const key = (s, fallback = 'other') => String(s || '')
  .toLowerCase()
  .replace(/[^a-z0-9\u0600-\u06ff]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 60) || fallback;

export function clientIp(headers) {
  const h = headers;
  const raw = h.get('x-forwarded-for') || h.get('cf-connecting-ip') || h.get('x-real-ip') || h.get('x-client-ip') || '';
  const first = String(raw).split(',')[0].trim();
  return /^[0-9a-fA-F:.]{3,45}$/.test(first) ? first : '';
}

export function maskIp(ip) {
  const v = String(ip || '').trim();
  if (!v) return 'unknown';
  if (v.includes(':')) {
    const parts = v.split(':').filter(Boolean).slice(0, 3);
    return `${parts.join(':')}::`;
  }
  const p = v.split('.');
  if (p.length === 4) return `${p[0]}.${p[1]}.${p[2]}.0`;
  return 'unknown';
}

/** Country / region / city / coordinates from whatever CDN headers exist. */
export function geo(headers) {
  const dec = (s) => { try { return decodeURIComponent(String(s || '').replace(/\+/g, ' ')); } catch { return String(s || ''); } };
  const countryCode = String(headers.get('x-vercel-ip-country') || headers.get('cf-ipcountry') || '').toUpperCase().slice(0, 2);
  return {
    countryCode,
    country: String(headers.get('x-vercel-ip-country-name') || headers.get('cf-ipcountry') || '').slice(0, 60),
    region: dec(headers.get('x-vercel-ip-country-region') || headers.get('cf-region')),
    city: dec(headers.get('x-vercel-ip-city') || headers.get('cf-ipcity') || headers.get('cf-city')).slice(0, 60),
    timezone: String(headers.get('x-vercel-ip-timezone') || headers.get('cf-timezone') || '').slice(0, 40),
    lat: String(headers.get('x-vercel-ip-latitude') || '').slice(0, 12),
    lon: String(headers.get('x-vercel-ip-longitude') || '').slice(0, 12),
  };
}

/** A deliberately small user-agent reading: browser, OS, device class. */
export function uaInfo(ua) {
  const s = String(ua || '');
  const browser = /Edg\//.test(s) ? 'Edge'
    : /OPR\/|Opera/.test(s) ? 'Opera'
      : /SamsungBrowser/.test(s) ? 'Samsung Internet'
        : /Chrome\//.test(s) ? 'Chrome'
          : /Firefox\//.test(s) ? 'Firefox'
            : /Safari\//.test(s) ? 'Safari'
              : /bot|crawl|spider|slurp/i.test(s) ? 'Bot' : 'Other';
  const os = /Android/.test(s) ? 'Android'
    : /iPhone|iPad|iPod/.test(s) ? 'iOS'
      : /Windows/.test(s) ? 'Windows'
        : /Mac OS X|Macintosh/.test(s) ? 'macOS'
          : /Linux/.test(s) ? 'Linux' : 'Other';
  const device = /iPad|Tablet/.test(s) ? 'tablet' : /Mobi|Android|iPhone/.test(s) ? 'mobile' : 'desktop';
  return { browser, os, device };
}

/** Salted, truncated hash: stable per visitor per day, useless for identifying a person. */
export function visitorHash(ip, ua, day = pkDay()) {
  return crypto.createHash('sha256').update(`${SALT}|${ip}|${ua}|${day}`).digest('hex').slice(0, 20);
}

const bump = (path, by = 1) => adminRtdb().ref(path).set({ '.sv': { increment: by } });

export function analyticsReady() {
  return Boolean(rtdbUrl());
}

/**
 * Record one page view with all the server-only facts. Everything is best-effort: analytics must
 * never slow a page or throw into a request.
 */
export async function recordHit({ headers, body = {} }) {
  if (!analyticsReady()) return { ok: false, reason: 'no-rtdb' };
  if (String(process.env.ANALYTICS_OFF || '') === '1') return { ok: false, reason: 'off' };

  const ua = String(headers.get('user-agent') || '');
  if (/bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit/i.test(ua)) {
    return { ok: false, reason: 'bot' };
  }

  const ip = clientIp(headers);
  const g = geo(headers);
  const { browser, os, device } = uaInfo(ua);
  const day = pkDay();
  const hour = pkHour();
  const page = key(body.path || '/', 'home');
  const refRaw = String(body.referrer || headers.get('referer') || '');
  let ref = 'direct';
  try {
    if (refRaw) {
      const host = new URL(refRaw).hostname.replace(/^www\./, '');
      ref = /mizanora\./.test(host) ? 'internal' : /google|bing|duckduckgo|yahoo|yandex/.test(host) ? 'search' : key(host, 'other');
    }
  } catch { ref = 'direct'; }
  const vid = visitorHash(ip, ua, day);
  const masked = maskIp(ip);
  const cc = g.countryCode || 'XX';

  const writes = [
    bump(`an/v/${day}`),
    bump(`an/hour/${day}/${hour}`),
    bump(`an/pg/${day}/${page}`),
    bump(`an/c/${day}/${cc}`),
    bump(`an/city/${day}/${key(g.city, 'unknown')}`),
    bump(`an/br/${day}/${key(browser)}`),
    bump(`an/os/${day}/${key(os)}`),
    bump(`an/dev/${day}/${key(device)}`),
    bump(`an/ref/${day}/${key(ref)}`),
    bump(`an/ip/${day}/${key(masked, 'unknown')}`),
    // one marker per visitor per day → unique visitors without reading the whole day
    adminRtdb().ref(`an/uv/${day}/${vid}`).set(true),
  ];

  // A compact "last visitors" row (one per visitor per day, overwritten on each page view).
  const detail = {
    t: Date.now(),
    page,
    cc,
    city: g.city || '',
    region: g.region || '',
    tz: g.timezone || '',
    ip: FULL_IP ? ip : masked,
    ua: browser,
    os,
    dev: device,
    ref,
  };
  writes.push(adminRtdb().ref(`an/last/${day}/${vid}`).set(detail));

  try {
    await Promise.all(writes);
    return { ok: true, day, country: cc };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

const addMap = (acc, obj) => { for (const [k, v] of Object.entries(obj || {})) acc[k] = (acc[k] || 0) + (Number(v) || 0); return acc; };
const topList = (map, n = 12) => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ key: k, value: v }));

/** Everything `/admin/traffic` needs, in one read pass. */
export async function readTraffic(days = 14, goal = 100000) {
  if (!analyticsReady()) return { ok: false, setup: true };
  const n = Math.max(1, Math.min(90, Number(days) || 14));
  const list = Array.from({ length: n }, (_, i) => pkDay(n - 1 - i));
  const rtdb = adminRtdb();
  const get = (path) => rtdb.ref(path).get().then((s) => s.val() || {}).catch(() => ({}));

  const [views, uniques, pages, countries, cities, browsers, oses, devices, refs, ips, last] = await Promise.all([
    Promise.all(list.map((d) => rtdb.ref(`an/v/${d}`).get().then((s) => Number(s.val()) || 0).catch(() => 0))),
    Promise.all(list.map((d) => rtdb.ref(`an/uv/${d}`).get().then((s) => Object.keys(s.val() || {}).length).catch(() => 0))),
    Promise.all(list.map((d) => get(`an/pg/${d}`))),
    Promise.all(list.map((d) => get(`an/c/${d}`))),
    Promise.all(list.map((d) => get(`an/city/${d}`))),
    Promise.all(list.map((d) => get(`an/br/${d}`))),
    Promise.all(list.map((d) => get(`an/os/${d}`))),
    Promise.all(list.map((d) => get(`an/dev/${d}`))),
    Promise.all(list.map((d) => get(`an/ref/${d}`))),
    Promise.all(list.map((d) => get(`an/ip/${d}`))),
    get(`an/last/${pkDay()}`),
  ]);

  const hours = await Promise.all(Array.from({ length: 24 }, (_, i) => `${pkDay()}/${String(i).padStart(2, '0')}`)
    .map((k) => rtdb.ref(`an/hour/${k}`).get().then((s) => Number(s.val()) || 0).catch(() => 0)));

  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const series = list.map((d, i) => ({ day: d, views: views[i], visitors: uniques[i] }));
  const today = series[series.length - 1] || { day: pkDay(), views: 0, visitors: 0 };
  const last7 = series.slice(-7);
  const last30 = series.slice(-30);

  const recent = Object.values(last || {})
    .filter(Boolean)
    .sort((a, b) => (b.t || 0) - (a.t || 0))
    .slice(0, 40);

  return {
    ok: true,
    days: n,
    goal,
    today: {
      ...today,
      goalPct: Math.min(100, Math.round((today.visitors / goal) * 1000) / 10),
      viewsGoalPct: Math.min(100, Math.round((today.views / goal) * 1000) / 10),
    },
    series,
    totals: {
      views: sum(views),
      visitors: sum(uniques),
      last7Views: sum(last7.map((x) => x.views)),
      last7Visitors: sum(last7.map((x) => x.visitors)),
      last30Views: sum(last30.map((x) => x.views)),
      last30Visitors: sum(last30.map((x) => x.visitors)),
      perDayAvg: Math.round(sum(uniques) / Math.max(1, n)),
    },
    hours,
    countries: topList(countries.reduce(addMap, {}), 20),
    cities: topList(cities.reduce(addMap, {}), 20),
    browsers: topList(browsers.reduce(addMap, {})),
    systems: topList(oses.reduce(addMap, {})),
    devices: topList(devices.reduce(addMap, {})),
    referrers: topList(refs.reduce(addMap, {})),
    networks: topList(ips.reduce(addMap, {}), 20),
    pages: topList(pages.reduce(addMap, {}), 20),
    recent,
    fullIp: FULL_IP,
  };
}

/** Keep the analytics namespace from growing forever. */
export async function cleanupAnalytics(keepDays = 60) {
  if (!analyticsReady()) return { ok: false, removed: 0 };
  const keep = Math.max(7, Math.min(365, Number(keepDays) || 60));
  const cutoff = pkDay(keep);
  const rtdb = adminRtdb();
  let removed = 0;
  for (const bucket of ['v', 'hour', 'pg', 'c', 'city', 'br', 'os', 'dev', 'ref', 'ip', 'uv', 'last']) {
    try {
      const snap = await rtdb.ref(`an/${bucket}`).orderByKey().endBefore(cutoff).limitToFirst(500).get();
      const patch = {};
      snap.forEach((child) => { patch[child.key] = null; removed += 1; });
      if (Object.keys(patch).length) await rtdb.ref(`an/${bucket}`).update(patch);
    } catch { /* an empty bucket is not an error */ }
  }
  return { ok: true, removed };
}
