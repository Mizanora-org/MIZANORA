// MIZANORA IPTV — the customer's own account (Xtream user). Pure code, testable.
//
// Flow: Google/email se sign in -> "Free key" -> 24 ghante ki line foran ban jati hai
// (admin ka intezaar nahi). Aik account ko zindagi mein aik trial.

import { IPTV, cleanPhone } from './iptv.js';
import { credentials } from './iptvReseller.js';

export const TRIAL_HOURS = IPTV.trialHours; // 24
export const MAX_LINES_PER_USER = 3;

/** Kya ye user abhi trial le sakta hai? */
export function canClaim(lines = [], now = Date.now()) {
  const rows = Array.isArray(lines) ? lines : [];
  if (rows.some((l) => l && l.trial === true)) {
    return { ok: false, code: 'trial_used', error: 'Aap trial pehle le chuke hain. Plan lene ke liye WhatsApp karein.' };
  }
  const live = rows.filter((l) => (Number(l.expiresAt) || 0) > now && l.status !== 'cancelled');
  if (live.length) {
    return { ok: false, code: 'has_line', error: 'Aap ke paas pehle se chalti line hai — usi ko use karein ya renew karein.' };
  }
  if (rows.length >= MAX_LINES_PER_USER) {
    return { ok: false, code: 'too_many', error: 'Is account par bohat lines hain — WhatsApp par baat karein.' };
  }
  return { ok: true, remaining: MAX_LINES_PER_USER - rows.length };
}

/** Trial line ka doc — jahan uid hai, wahan /account/iptv khud dikha deta hai. */
export function trialLine({ uid, email, name, phone, device = 'xtream' }, now = Date.now(), rnd = Math.random) {
  const { username, password } = credentials(rnd);
  const cleanName = String(name || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60)
    || String(email || '').split('@')[0].slice(0, 60) || 'Mizanora user';
  return {
    uid: String(uid || ''),
    email: String(email || '').toLowerCase().slice(0, 120),
    clientName: cleanName,
    name: cleanName,
    phone: cleanPhone(phone) || '',
    username,
    password,
    mac: device === 'mag' ? '' : '',
    device: ['xtream', 'mag'].includes(device) ? device : 'xtream',
    server: 'http://dns.mizanora.tv:8080',
    plan: 'trial',
    maxDevices: 1,
    trial: true,
    price: 0,
    months: 0,
    expiresAt: now + TRIAL_HOURS * 3600e3,
    status: 'active',
    createdAt: now,
    resellerId: '',
    resellerName: 'Mizanora',
  };
}

/** Line ka natija jo browser ko wapas jata hai (password ke saath, kyunki ye uski apni line hai). */
export function publicLine(line = {}) {
  return {
    id: line.id || '',
    username: line.username || '',
    password: line.password || '',
    mac: line.mac || '',
    server: line.server || 'http://dns.mizanora.tv:8080',
    plan: line.plan || 'trial',
    trial: line.trial === true,
    maxDevices: Number(line.maxDevices) || 1,
    expiresAt: Number(line.expiresAt) || 0,
    status: line.status || 'active',
    resellerName: line.resellerName || 'Mizanora',
    resellerPhone: line.resellerPhone || '',
  };
}

/** Setup ke 3 steps — page par dikhte hain. */
export const SETUP_STEPS = [
  ['TiviMate / IPTV Smarters kholein', 'Phone, Fire Stick ya Android TV par — dono free hain.'],
  ['"Xtream Codes" chunein', 'Server, username aur password daalein (neeche se copy karein).'],
  ['Live TV dabayein', 'Channels khud load ho jayenge — EPG bhi saath aati hai.'],
];

export const DEVICE_HELP = [
  ['Android TV / Fire Stick', 'TiviMate', '/blog/tivimate-playlist-setup-guide'],
  ['Samsung / LG Smart TV', 'Set IPTV', '/blog/smart-tv-iptv-setup-samsung-lg'],
  ['MAG box / Stalker', 'Portal URL + MAC', '/blog/stalker-portal-mac-setup-mag-box'],
];
