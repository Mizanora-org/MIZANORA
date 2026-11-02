import { adminDb, adminReady } from '../firebase-admin';
import { deviceHash, sameSecret, clientIp } from './security';
import { accessDenied } from './access';

// IPTV GATEWAY — line (customer) ki tasdeeq aur device limit.
// username/password sirf `iptvLines` mein hote hain; browser ko sirf apni hi line dikhti hai.

const STATE_OK = new Set(['active', 'trial']);

// 10 second ka cache: live playlist har 6 second par maangi jati hai — Firestore par bojh na pare.
// Suspend/expiry 10 second ke andar asar kar deta hai.
const verifyCache = new Map();
const VERIFY_TTL = 10_000;

// v47: brute-force lockout. 8 ghalat password ke baad 15 minute line lock.
// Memory (fast) + Firestore `iptvLockouts/{username}` (instances ke darmiyan share).
const MAX_FAILS = 8;
const LOCK_MS = 15 * 60_000;
const failMem = new Map();

async function lockedUntil(user) {
  const m = failMem.get(user);
  if (m && Number(m.until) > Date.now()) return Number(m.until);
  if (!adminReady()) return 0;
  try {
    const snap = await adminDb().collection('iptvLockouts').doc(user).get();
    if (!snap.exists) return 0;
    const d = snap.data() || {};
    const until = Number(d.until) || 0;
    if (until > Date.now()) { failMem.set(user, { count: Number(d.count) || 0, until }); return until; }
    return 0;
  } catch { return 0; }
}

async function registerFailure(user) {
  const now = Date.now();
  const prev = failMem.get(user) || { count: 0, until: 0 };
  const count = (Number(prev.count) || 0) + 1;
  const until = count >= MAX_FAILS ? now + LOCK_MS : 0;
  failMem.set(user, { count, until });
  if (failMem.size > 3000) failMem.clear();
  if (!adminReady()) return;
  try {
    await adminDb().collection('iptvLockouts').doc(user).set({ username: user, count, until, at: now }, { merge: true });
  } catch { /* ignore */ }
}

async function clearFailures(user) {
  failMem.delete(user);
  if (!adminReady()) return;
  try { await adminDb().collection('iptvLockouts').doc(user).delete(); } catch { /* ignore */ }
}

/** Username + password → line doc, ya { error }. Bina Firestore ke gateway band rehta hai. */
export async function verifyLine(username, password) {
  const user = String(username || '').trim();
  const pass = String(password || '');
  if (!user || !pass) return { ok: false, status: 401, error: 'Username/password missing' };
  if (!adminReady()) return { ok: false, status: 503, error: 'Gateway not configured' };

  // v47: blacklist/whitelist — username pehle, password ke baghair bhi.
  const access = await accessDenied({ user });
  if (access.blocked) return { ok: false, status: 403, error: 'Access blocked' };

  const lock = await lockedUntil(user);
  if (lock) {
    const mins = Math.max(1, Math.ceil((lock - Date.now()) / 60_000));
    return { ok: false, status: 429, error: `Bohat dafa ghalat password — ${mins} minute baad koshish karein.` };
  }

  const hit = verifyCache.get(user);
  if (hit && Date.now() - hit.at < VERIFY_TTL && sameSecret(pass, hit.pass)) return hit.result;

  try {
    const snap = await adminDb().collection('iptvLines').where('username', '==', user).limit(1).get();
    if (snap.empty) return { ok: false, status: 401, error: 'Invalid login' };
    const doc = snap.docs[0];
    const line = { id: doc.id, ...doc.data() };

    if (!sameSecret(pass, line.password)) {
      await registerFailure(user);
      return { ok: false, status: 401, error: 'Invalid login' };
    }
    await clearFailures(user);

    const state = String(line.status || 'active');
    if (!STATE_OK.has(state)) return { ok: false, status: 403, error: state === 'suspended' ? 'Line suspended' : 'Line inactive', line };

    const exp = Number(line.expiresAt) || 0;
    if (exp && exp < Date.now()) return { ok: false, status: 403, error: 'Line expired', line };

    const result = { ok: true, line };
    if (verifyCache.size > 2000) verifyCache.clear();
    verifyCache.set(user, { at: Date.now(), pass, result });
    return result;
  } catch (e) {
    console.error('gateway line check failed:', e.message);
    return { ok: false, status: 503, error: 'Gateway busy' };
  }
}

// In-memory fallback: agar Firestore write fail ho jaye to bhi ek instance par limit chalti rahe.
const local = new Map();
const WINDOW = 90_000; // 90 second — is se purana device "gaya hua" maana jata hai

/**
 * Device limit: aik line par maxDevices se zyada device nahi.
 * Firestore doc `iptvSessions/{username}` mein device hashes + waqt. Writes throttle hain (60s),
 * taake 1000 viewers par Firestore par bojh na pare.
 */
export async function checkDevice(line, req) {
  // v47: IP + MAC blacklist / whitelist (device limit se pehle).
  const access = await accessDenied({ ip: clientIp(req), user: line && line.username, mac: line && line.mac });
  if (access.blocked) return { ok: false, status: 403, error: `Access blocked (${access.reason})` };

  const max = Math.max(1, Number(line.maxDevices) || 1);
  const ip = (req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'ip';
  const ua = String(req.headers.get('user-agent') || 'player').slice(0, 80);
  const hash = deviceHash(ip, ua);
  const now = Date.now();

  const memKey = line.username || line.id;
  const mem = (local.get(memKey) || new Map());
  for (const [k, t] of mem) if (now - t > WINDOW) mem.delete(k);

  if (!adminReady()) {
    if (mem.size >= max && !mem.has(hash)) return { ok: false, error: 'Too many connections' };
    mem.set(hash, now); local.set(memKey, mem);
    return { ok: true, devices: mem.size, max };
  }

  try {
    const db = adminDb();
    const ref = db.collection('iptvSessions').doc(memKey);
    const snap = await ref.get();
    const data = snap.exists ? (snap.data() || {}) : {};
    const devices = { ...(data.devices || {}) };
    for (const [k, t] of Object.entries(devices)) if (now - Number(t) > WINDOW) delete devices[k];

    const known = Boolean(devices[hash]);
    if (!known && Object.keys(devices).length >= max) return { ok: false, error: 'Too many connections', devices: Object.keys(devices).length, max };

    devices[hash] = now;
    mem.set(hash, now); local.set(memKey, mem);

    const lastWrite = Number(data.updatedAt) || 0;
    if (!known || now - lastWrite > 60_000) {
      await ref.set({ devices, updatedAt: now, lineId: line.id || '' }, { merge: true }).catch(() => {});
    }
    return { ok: true, devices: Object.keys(devices).length, max };
  } catch {
    // Firestore fail → memory par chalao, stream band na ho
    if (mem.size >= max && !mem.has(hash)) return { ok: false, error: 'Too many connections' };
    mem.set(hash, now); local.set(memKey, mem);
    return { ok: true, devices: mem.size, max };
  }
}
