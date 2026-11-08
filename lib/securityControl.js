import crypto from 'node:crypto';
import net from 'node:net';
import { adminRtdb, adminReady, rtdbUrl } from './firebase-admin.js';
import { limitRequest } from './requestRate.js';

// Private RTDB only: no customer data, token, request body, URL query or API key is logged.
// The public repository and analytics counters NEVER contain these full IP security records.
export const securityReady = () => adminReady() && Boolean(rtdbUrl());
export const ipKey = (ip) => crypto.createHash('sha256').update(String(ip)).digest('hex');
export const pkDay = (at = Date.now()) => new Date(at + 5 * 3600_000).toISOString().slice(0, 10);

// Trust proxy headers ONLY on Vercel, or on an explicitly configured trusted reverse proxy.
// Deployments that expose the origin to untrusted traffic should not set TRUST_PROXY_HEADERS.
export function securityIp(headers) {
  if (!process.env.VERCEL && process.env.TRUST_PROXY_HEADERS !== '1') return '';
  const raw = headers.get('x-forwarded-for') || headers.get('cf-connecting-ip') || '';
  const first = String(raw).split(',')[0].trim();
  return net.isIP(first) ? first.toLowerCase() : '';
}

const kinds = new Set(['admin-auth-missing', 'admin-token-invalid', 'admin-access-denied',
  'probe-sensitive-path', 'image-relay-invalid', 'tv-relay-invalid', 'rate-limit']);
const levels = new Set(['low', 'medium', 'high']);
let lastPruned = '';
export async function pruneSecurityEvents(now = Date.now()) {
  if (!securityReady()) return 0;
  const cutoff = pkDay(now - 31 * 86400_000);
  let removed = 0;
  // Prune *all* older buckets, including gaps (a site may be idle for months).
  // Bounded batches prevent one request from downloading the entire audit history.
  for (let i = 0; i < 10; i++) {
    const root = adminRtdb().ref('security/events');
    const snap = await root.orderByKey().endAt(cutoff).limitToFirst(100).once('value');
    const keys = Object.keys(snap.val() || {});
    if (!keys.length) break;
    const updates = Object.fromEntries(keys.map((key) => [key, null]));
    await root.update(updates);
    removed += keys.length;
    if (keys.length < 100) break;
  }
  return removed;
}

export async function logSecurityEvent(req, kind, { reason = '', severity = 'medium' } = {}) {
  const ip = securityIp(req.headers);
  if (!securityReady() || !kinds.has(kind) || !limitRequest(`audit-${kind}`, ip || 'unknown', 5, 10 * 60_000).allowed) return false;
  let path = '';
  try { path = new URL(req.url).pathname.slice(0, 160); } catch { /* no query or body is ever recorded */ }
  const now = Date.now();
  const event = {
    at: now, ip: ip || 'unknown', kind, severity: levels.has(severity) ? severity : 'medium',
    route: path, reason: String(reason).replace(/[^a-z0-9_-]/gi, '').slice(0, 48),
    ua: String(req.headers.get('user-agent') || '').replace(/[<>]/g, '').slice(0, 120),
    country: String(req.headers.get('x-vercel-ip-country') || '').replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase(),
  };
  try {
    await adminRtdb().ref(`security/events/${pkDay(now)}`).push(event);
    if (lastPruned !== pkDay(now)) {
      lastPruned = pkDay(now);
      // Backup cleanup when cron is not configured; never run it on every hit.
      await pruneSecurityEvents(now);
    }
    return true;
  } catch { return false; } // auditing must not break a customer request
}

let cachedBlocks = new Map();
let cacheUntil = 0;
let loading = null;
export async function blockedMap(force = false) {
  if (!securityReady()) return cachedBlocks;
  if (!force && Date.now() < cacheUntil) return cachedBlocks;
  if (loading) return loading;
  loading = (async () => {
    try {
      const snap = await adminRtdb().ref('security/blocked').once('value');
      cachedBlocks = new Map(Object.entries(snap.val() || {}));
      cacheUntil = Date.now() + 20_000;
    } catch { cacheUntil = Date.now() + 5000; } // preserve previous blocks when RTDB is temporarily down
    return cachedBlocks;
  })();
  try { return await loading; } finally { loading = null; }
}

export async function blockedIp(ip) {
  if (!ip) return null;
  const entry = (await blockedMap()).get(ipKey(ip));
  return entry && (!entry.until || entry.until > Date.now()) ? entry : null;
}

export async function setBlockedIp(ip, { reason = '', hours = 24, by = '' } = {}) {
  if (!securityReady()) throw new Error('Private Realtime Database is not configured; blocking is unavailable.');
  const address = String(ip || '').trim().toLowerCase();
  if (!net.isIP(address)) throw new Error('Enter a valid full IPv4 or IPv6 address.');
  const selected = [1, 24, 168, 720].includes(Number(hours)) ? Number(hours) : 24;
  const value = { ip: address, at: Date.now(), until: Date.now() + selected * 3600_000,
    reason: String(reason).replace(/[<>]/g, '').trim().slice(0, 140), by: String(by).slice(0, 100) };
  // Do not silently overflow the list: beyond 1000 some blocks would go unchecked.
  const map = await blockedMap(true);
  if (map.size >= 1000 && !map.has(ipKey(address))) throw new Error('Blocklist is full (1000). Remove an old block first.');
  await adminRtdb().ref(`security/blocked/${ipKey(address)}`).set(value);
  cachedBlocks.set(ipKey(address), value);
  return value;
}

export async function unblockIp(ip) {
  if (!securityReady()) throw new Error('Private Realtime Database is not configured.');
  const address = String(ip || '').trim().toLowerCase();
  if (!net.isIP(address)) throw new Error('Invalid IP address.');
  await adminRtdb().ref(`security/blocked/${ipKey(address)}`).remove();
  cachedBlocks.delete(ipKey(address));
}

export async function securityReport(days = 7) {
  if (!securityReady()) return { ok: false, error: 'Private Realtime Database is not configured. Set FIREBASE_SERVICE_ACCOUNT and FIREBASE_DATABASE_URL in Vercel.' };
  const span = Math.max(1, Math.min(14, Math.round(Number(days)) || 7));
  const selected = Array.from({ length: span }, (_, i) => pkDay(Date.now() - i * 86400_000));
  const [blocks, ...daily] = await Promise.all([
    blockedMap(true), ...selected.map((d) => adminRtdb().ref(`security/events/${d}`).limitToLast(100).once('value')),
  ]);
  const events = daily.flatMap((snap) => Object.entries(snap.val() || {}).map(([id, item]) => ({ id, ...item })))
    .sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 200);
  return {
    ok: true, days: span, events,
    alerts: events.filter((e) => e.severity === 'high').length,
    blocked: [...blocks.values()].filter((b) => !b.until || b.until > Date.now()).sort((a, b) => b.at - a.at),
  };
}
