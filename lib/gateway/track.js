import { adminDb, adminReady } from '../firebase-admin';
import { clientIp, deviceHash } from './security';

// IPTV TRACKING — admin ko dikhta hai: kaun online hai, kya dekh raha hai, kab aaya.
// Aik hi line par har second likhna mehnga hai, is liye memory mein throttle (30s) hai.

const lastTouch = new Map();
const lastEvent = new Map();
const TOUCH_MS = 30_000;
const AD_COOLDOWN = 6 * 3600_000; // aik line ko 6 ghante mein aik dafa ad
const adMemory = new Map();
const EVENT_MS = 60_000;

const uaName = (ua = '') => {
  const s = String(ua);
  if (/tivimate/i.test(s)) return 'TiviMate';
  if (/smarters/i.test(s)) return 'Smarters';
  if (/xcIPTV|ott|navigator/i.test(s)) return 'XCIPTV';
  if (/vlc/i.test(s)) return 'VLC';
  if (/mag|stb/i.test(s)) return 'MAG/Stalker';
  if (/kodi/i.test(s)) return 'Kodi';
  if (/mozilla/i.test(s)) return 'Browser';
  return s ? s.slice(0, 20) : 'Player';
};

/** Live session update — "kaun abhi dekh raha hai" isi se banta hai. */
export async function touchSession(line, req, extra = {}) {
  if (!adminReady()) return;
  const key = line.username || line.id;
  const now = Date.now();
  if (now - (lastTouch.get(key) || 0) < TOUCH_MS && !extra.force) return;
  lastTouch.set(key, now);
  if (lastTouch.size > 3000) lastTouch.clear();

  try {
    await adminDb().collection('iptvSessions').doc(key).set({
      lineId: line.id || '',
      username: line.username || '',
      clientName: line.clientName || line.name || '',
      resellerId: line.resellerId || '',
      plan: line.plan || '',
      ip: clientIp(req),
      userAgent: String(req.headers.get('user-agent') || '').slice(0, 120),
      app: uaName(req.headers.get('user-agent') || ''),
      device: deviceHash(clientIp(req), String(req.headers.get('user-agent') || '')),
      channel: extra.channel || '',
      kind: extra.kind || 'live',
      lastSeen: now,
      updatedAt: now,
    }, { merge: true }).catch(() => {});
  } catch { /* tracking fail ho to stream band na ho */ }
}

/** Event log — login, stream start, expire, etc. (60s throttle per line+type). */
export async function trackEvent(type, line, req, extra = {}) {
  if (!adminReady()) return;
  const key = `${type}:${line.username || line.id}`;
  const now = Date.now();
  if (now - (lastEvent.get(key) || 0) < EVENT_MS) return;
  lastEvent.set(key, now);
  if (lastEvent.size > 3000) lastEvent.clear();

  try {
    await adminDb().collection('iptvEvents').add({
      type,
      lineId: line.id || '',
      username: line.username || '',
      clientName: line.clientName || line.name || '',
      resellerId: line.resellerId || '',
      ip: clientIp(req),
      app: uaName(req.headers.get('user-agent') || ''),
      ...extra,
      at: now,
    });
  } catch { /* ignore */ }
}

/**
 * Ad due hai? Firestore par `iptvSessions` doc mein adChannel/adAt dekha jata hai.
 * 6 ghante tak wohi channel dobara khole to ad skip — user tang na ho.
 */
export async function adDue(line, channelId) {
  const key = `${line.username || line.id}:${channelId}`;
  const now = Date.now();
  const mem = adMemory.get(key) || 0;
  if (now - mem < AD_COOLDOWN) return false;
  if (!adminReady()) return true;
  try {
    const snap = await adminDb().collection('iptvSessions').doc(line.username || line.id).get();
    const d = snap.exists ? snap.data() || {} : {};
    if (String(d.adChannel || '') === String(channelId) && now - (Number(d.adAt) || 0) < AD_COOLDOWN) return false;
    return true;
  } catch { return true; }
}

export async function markAd(line, channelId) {
  const key = `${line.username || line.id}:${channelId}`;
  adMemory.set(key, Date.now());
  if (adMemory.size > 3000) adMemory.clear();
  if (!adminReady()) return;
  await adminDb().collection('iptvSessions').doc(line.username || line.id)
    .set({ adChannel: String(channelId), adAt: Date.now() }, { merge: true }).catch(() => {});
}

export const appName = uaName;
