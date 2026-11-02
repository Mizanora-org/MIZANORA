import crypto from 'node:crypto';

// IPTV GATEWAY — security helpers. Sab kuch server par.
//
// Usool: client ko kabhi upstream (source) ka pata nahi chalta. Har stream link aik
// "sealed token" hota hai — AES-256-GCM se bandha hua, 3 ghante mein khud mar jata hai.
// Browser ke Network tab mein sirf /api/gw/s?t=v1.xxxxx dikhta hai.

const ephemeral = crypto.randomBytes(32);
const secret = () => process.env.IPTV_GW_SECRET || process.env.TV_PROXY_SECRET || process.env.FIREBASE_PRIVATE_KEY || ephemeral;

const keyOf = (purpose) => crypto.createHash('sha256').update(`${purpose}:${secret()}`).digest();
const b64 = (buf) => Buffer.from(buf).toString('base64url');

export const SEAL_TTL = 3 * 3600; // 3 ghante — itne mein playlist dobara banti hai

/** URL (ya koi bhi chhota object) ko opaque token mein band karta hai. */
export function seal(payload, ttlSec = SEAL_TTL) {
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyOf('stream'), iv);
    const ttl = Number(ttlSec);
    const life = Number.isFinite(ttl) ? (ttl < 0 ? ttl : Math.max(30, ttl)) : SEAL_TTL;
    const body = JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + life });
    const enc = Buffer.concat([cipher.update(body, 'utf8'), cipher.final()]);
    return `v1.${b64(Buffer.concat([iv, cipher.getAuthTag(), enc]))}`;
  } catch { return ''; }
}

export function open(token) {
  const raw = String(token || '').trim();
  if (!raw.startsWith('v1.')) return null;
  try {
    const buf = Buffer.from(raw.slice(3), 'base64url');
    if (buf.length < 40) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const dec = crypto.createDecipheriv('aes-256-gcm', keyOf('stream'), iv);
    dec.setAuthTag(tag);
    const json = Buffer.concat([dec.update(buf.subarray(28)), dec.final()]).toString('utf8');
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== 'object') return null;
    if (Number(obj.exp) && Math.floor(Date.now() / 1000) > Number(obj.exp)) return null;
    return obj;
  } catch { return null; }
}

export const sealUrl = (url) => seal({ u: String(url || '') });
export const openUrl = (token) => { const o = open(token); return o && typeof o.u === 'string' ? o.u : ''; };

/** Short fingerprint — device limit ke liye (IP + user agent). */
export const deviceHash = (ip, ua) => crypto.createHash('sha256').update(`${ip}|${ua}`).digest('base64url').slice(0, 16);

/** Constant-time password compare. */
export function sameSecret(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

export function clientIp(req) {
  for (const k of ['x-vercel-forwarded-for', 'cf-connecting-ip', 'x-real-ip', 'x-forwarded-for']) {
    const v = req.headers.get(k);
    if (v) { const first = String(v).split(',')[0].trim(); if (first) return first.replace(/^::ffff:/i, ''); }
  }
  return '0.0.0.0';
}

// In-memory token bucket. Vercel ke har instance par alag, magar basic flooding rok deta hai.
const buckets = new Map();
export function rateLimit(ip, name, max = 120, windowMs = 60_000) {
  const now = Date.now();
  if (buckets.size > 5000) { for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k); }
  const k = `${name}:${ip}`;
  const cur = buckets.get(k);
  if (!cur || now > cur.reset) { buckets.set(k, { n: 1, reset: now + windowMs }); return true; }
  cur.n += 1;
  return cur.n <= max;
}

/** JSON jawab jo kabhi cache nahi hota (playlist/API). */
export const noStore = (body, status = 200, extra = {}) => new Response(
  typeof body === 'string' ? body : JSON.stringify(body),
  { status, headers: { 'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json', 'Cache-Control': 'no-store', ...extra } },
);
