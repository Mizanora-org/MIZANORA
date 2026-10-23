import { NextResponse } from 'next/server';
import { revalidateTag, unstable_cache } from 'next/cache';
import { adminDb, adminReady } from './firebase-admin';
import { noteFirestoreError, quotaError, quotaTripped } from './quota';
import { rtdbOn, rtdbPublicGet } from './rtdb';
import { cleanHours, DEFAULT_HOURS } from './shopHours';

// SITE STATUS (kill switch + high alert), stored in Firestore siteMeta/status and controlled from Admin > Control.
//   normal : everything works
//   saver  : HIGH ALERT. The shop stays online but never refreshes the catalogue from Firebase and the non-essential features
//            (assistant, AI search, photo reports) are off. Orders, tracking and workers keep working.
//   down   : the website is SHUT DOWN. Visitors see your reason, every public API answers "closed", and nothing reads Firebase.
// The status itself costs at most one read every 10 minutes (and again right after you change it).
// Emergency without Firebase: set the Vercel variables SITE_MODE=down (or saver) and SITE_DOWN_REASON="..." and redeploy.
export const FEATURES = [
  ['orders', 'New orders and promo codes'],
  ['assistant', 'AI voice assistant (chat and voice)'],
  ['aiSearch', 'AI search helper'],
  ['imageReport', 'Broken-photo reports from visitors'],
  ['tracking', 'Order tracking by customers'],
  ['workers', 'Worker pages (apply, links, dashboard tools)'],
];
const SAVER_OFF = new Set(['assistant', 'aiSearch', 'imageReport']);
export const DEFAULT_STATUS = { mode: 'normal', reason: '', backAt: '', features: {}, since: 0, by: '', hours: DEFAULT_HOURS };

let lastKnown = DEFAULT_STATUS;
export const rememberStatus = (s) => { lastKnown = s; };

const clean = (d = {}) => ({
  mode: ['normal', 'saver', 'down'].includes(d.mode) ? d.mode : 'normal',
  reason: String(d.reason || '').slice(0, 400),
  backAt: String(d.backAt || '').slice(0, 80),
  features: Object.fromEntries(FEATURES.map(([k]) => [k, !(d.features && d.features[k] === false)])),
  since: Number(d.since) || 0,
  by: String(d.by || '').slice(0, 80),
  hours: cleanHours(d.hours), // v24: daily shop hours (the browser closes / opens the shop by the clock)
});
export const cleanStatus = clean;

// The status lives in BOTH databases. The Realtime Database is read first (its quota is separate, so the shut-down switch still
// works on the day Firestore's free reads are used up); Firestore is the fallback.
const read = unstable_cache(async () => {
  if (rtdbOn()) {
    try { const v = await rtdbPublicGet('siteStatus'); return v ? clean(v) : DEFAULT_STATUS; } catch (e) { /* not set up or not reachable: use Firestore */ }
  }
  if (!adminReady()) return DEFAULT_STATUS;
  if (quotaTripped()) throw quotaError();
  let d;
  try { d = await adminDb().collection('siteMeta').doc('status').get(); } catch (e) { noteFirestoreError(e); throw e; }
  return d.exists ? clean(d.data()) : DEFAULT_STATUS;
}, ['mz-site-status-v1'], { revalidate: 600, tags: ['sitestatus'] });

export async function getSiteStatus() {
  const m = String(process.env.SITE_MODE || '').toLowerCase();
  if (m === 'down' || m === 'saver') return clean({ mode: m, reason: process.env.SITE_DOWN_REASON || '' });
  if (quotaTripped()) return lastKnown; // quota used up: do not even try (the answer would be an error anyway)
  try { const s = await read(); lastKnown = s; return s; } catch (e) { if (!quotaTripped()) console.error('site status read failed:', e.message); return lastKnown; }
}
export const refreshStatus = () => { try { revalidateTag('sitestatus'); } catch { /* it refreshes by itself within 10 minutes */ } };

// For public API routes. Returns a ready response when the route must NOT run, otherwise null.
//   await denyIf('orders')  -> blocked when the site is down or the orders switch is off
//   await denyIf()          -> blocked only when the site is down
export async function denyIf(feature) {
  const s = await getSiteStatus();
  if (s.mode === 'down') return NextResponse.json({ ok: false, maintenance: true, items: [], products: [], error: s.reason ? `The shop is closed for now: ${s.reason}` : 'The shop is closed for a short time. Please come back soon.' }, { status: 503, headers: { 'Retry-After': '600' } });
  if (feature && (s.features[feature] === false || (s.mode === 'saver' && SAVER_OFF.has(feature)))) {
    return NextResponse.json({ ok: false, paused: true, items: [], products: [], error: s.reason ? `This is paused for a short time: ${s.reason}` : 'This part of the shop is paused for a short time. Please try again later.' }, { status: 503, headers: { 'Retry-After': '300' } });
  }
  return null;
}
