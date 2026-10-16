import { adminRtdb, adminReady, rtdbUrl } from './firebase-admin';

// REALTIME DATABASE helpers (server only). The Realtime Database is a SECOND free database next to Firestore with its own limits
// (1 GB stored, 10 GB download a month, no read/write counters). The shop uses it for everything that happens often and is small:
// visitor tracking, live users, daily counters, the shut-down switch and a backup copy of orders.
export const rtdbOn = () => adminReady() && Boolean(rtdbUrl());
export const dayKey = (t = Date.now()) => new Date(t + 5 * 3600e3).toISOString().slice(0, 10);   // Pakistan day (UTC+5)
export const hourKey = (t = Date.now()) => new Date(t + 5 * 3600e3).toISOString().slice(0, 13);  // 2026-10-16T07

// RTDB keys may not contain . $ # [ ] / so free text is made safe first.
export const safeKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);

// Add to counters at stats/<metric>/<bucket>/<key>. Never throws: tracking must never break an order.
export async function bump(entries) {
  if (!rtdbOn() || !entries.length) return;
  try {
    const { ServerValue } = await import('firebase-admin/database');
    const upd = {};
    for (const [path, n] of entries) upd[`stats/${path}`] = ServerValue.increment(n);
    await adminRtdb().ref().update(upd);
  } catch (e) { console.error('rtdb bump failed:', e.message); }
}

// Public read without the SDK (used for the shut-down status: works even when Firestore's quota is used up).
export async function rtdbPublicGet(path, timeoutMs = 3500) {
  const base = rtdbUrl();
  if (!base) throw new Error('no realtime database url');
  const r = await fetch(`${base}/${path}.json`, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
  if (!r.ok) throw new Error(`rtdb HTTP ${r.status}`);
  return r.json();
}
