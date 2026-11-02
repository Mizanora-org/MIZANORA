// MIZANORA IPTV — blacklist / whitelist ke rules. Pure code: koi Firestore, koi network.
//
// Do list hain: **block** (hamesha band) aur **allow** (sirf yeh chalein).
// Teen tarah ke entry: `ip` (exact, wildcard ya CIDR), `user` (username) aur `mac` (MAG box).
//
// Modes:
//   'blocklist' (default) — sab chalta hai, siwaye block list ke.
//   'allowlist'           — sirf allow list wale chalein. Allow list KHALI ho to sab chalta hai
//                           (warna ghalti se poora gateway band ho jata — is liye UI warning deta hai).

export const ACCESS_DOC = { collection: 'siteMeta', id: 'iptvAccess' };
export const ACCESS_MODES = ['blocklist', 'allowlist'];
export const ACCESS_KINDS = ['ip', 'user', 'mac'];
export const ACCESS_LIST_MAX = 500;      // per list per kind
export const ACCESS_NOTE_MAX = 120;

export const EMPTY_ACCESS = Object.freeze({
  mode: 'blocklist',
  block: { ip: [], user: [], mac: [] },
  allow: { ip: [], user: [], mac: [] },
  note: '',
  updatedAt: 0,
});

const cleanText = (v, max = 60) => String(v || '').trim().slice(0, max);

// ---------------------------------------------------------------- IP helpers
export function ipv4ToInt(ip) {
  const m = String(ip || '').trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return -1;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return -1;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

const isIpv6 = (s) => /^[0-9a-f:]{3,45}$/i.test(s) && s.includes(':');

/**
 * Ek IP entry ko normal karo: exact `1.2.3.4`, wildcard `1.2.3.*` ya CIDR `1.2.3.0/24`.
 * IPv6 exact bhi chalta hai (CIDR nahi).
 */
export function normalizeIp(value) {
  const raw = cleanText(value, 45).replace(/\s+/g, '');
  if (!raw) return '';
  const cidr = raw.match(/^(.+)\/(\d{1,2})$/);
  if (cidr) {
    const base = cidr[1];
    const bits = Number(cidr[2]);
    if (ipv4ToInt(base) < 0 || bits < 0 || bits > 32) return '';
    return `${base}/${bits}`;
  }
  if (/^\d{1,3}(\.\d{1,3}){0,2}\.\*$/.test(raw) || /^\*$/.test(raw)) {
    const head = raw.replace(/\.\*$/, '');
    if (head && ipv4ToInt(`${head}${'.0'.repeat(4 - head.split('.').length)}`) < 0) return '';
    return raw;
  }
  if (ipv4ToInt(raw) >= 0) return raw;
  if (isIpv6(raw)) return raw.toLowerCase();
  return '';
}

export function ipMatches(pattern, ip) {
  const p = String(pattern || '');
  const v = String(ip || '').trim();
  if (!p || !v) return false;
  if (p === '*') return true;
  if (p === v) return true;

  const cidr = p.match(/^(.+)\/(\d{1,2})$/);
  if (cidr) {
    const base = ipv4ToInt(cidr[1]);
    const target = ipv4ToInt(v);
    if (base < 0 || target < 0) return false;
    const bits = Number(cidr[2]);
    if (bits === 0) return true;
    const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0;
    return ((base & mask) >>> 0) === ((target & mask) >>> 0);
  }

  if (p.endsWith('.*')) {
    const head = p.slice(0, -2);
    return v.startsWith(`${head}.`);
  }
  return false;
}

// ---------------------------------------------------------------- users + MAC
export function normalizeUser(value) {
  return cleanText(value, 40).toLowerCase().replace(/[^a-z0-9._@-]/g, '');
}

export function normalizeMac(value) {
  const hex = String(value || '').toUpperCase().replace(/[^0-9A-F]/g, '');
  if (hex.length !== 12) return '';
  return hex.match(/.{2}/g).join(':');
}

/** Kisi bhi kind ki entry normal karo (invalid par ''). */
export function normalizeEntry(kind, value) {
  if (kind === 'ip') return normalizeIp(value);
  if (kind === 'user') return normalizeUser(value);
  if (kind === 'mac') return normalizeMac(value);
  return '';
}

export function matchEntry(kind, entry, subject) {
  if (kind === 'ip') return ipMatches(entry, subject);
  if (kind === 'user') return normalizeUser(entry) === normalizeUser(subject) && Boolean(normalizeUser(subject));
  if (kind === 'mac') return Boolean(normalizeMac(entry)) && normalizeMac(entry) === normalizeMac(subject);
  return false;
}

// ---------------------------------------------------------------- document clean
function cleanList(list = {}, kind) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const v = normalizeEntry(kind, raw);
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= ACCESS_LIST_MAX) break;
  }
  return out;
}

/** Firestore se aaya hua (ya user ka diya hua) doc saaf karo — kabhi throw nahi karta. */
export function cleanAccess(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const mode = ACCESS_MODES.includes(src.mode) ? src.mode : 'blocklist';
  const pick = (list) => ({
    ip: cleanList(src[list]?.ip, 'ip'),
    user: cleanList(src[list]?.user, 'user'),
    mac: cleanList(src[list]?.mac, 'mac'),
  });
  return {
    mode,
    block: pick('block'),
    allow: pick('allow'),
    note: cleanText(src.note, ACCESS_NOTE_MAX),
    updatedAt: Number(src.updatedAt) || 0,
  };
}

/**
 * Faisla: blocked hai ya nahi.
 * @returns {{blocked:boolean, reason:string, list?:'block'|'allow', kind?:string, entry?:string}}
 */
export function accessVerdict(rules, subject = {}) {
  const r = cleanAccess(rules);
  const me = { ip: String(subject.ip || '').trim(), user: normalizeUser(subject.user), mac: normalizeMac(subject.mac) };

  for (const kind of ACCESS_KINDS) {
    const hit = r.block[kind].find((e) => matchEntry(kind, e, me[kind]));
    if (hit) return { blocked: true, reason: `Blocked ${kind}: ${hit}`, list: 'block', kind, entry: hit };
  }

  if (r.mode === 'allowlist') {
    const hasAllow = ACCESS_KINDS.some((k) => r.allow[k].length > 0);
    if (hasAllow) {
      const anyAllow = ACCESS_KINDS.some((kind) => r.allow[kind].some((e) => matchEntry(kind, e, me[kind])));
      if (!anyAllow) return { blocked: true, reason: 'Not on the allow list', list: 'allow' };
    }
  }

  return { blocked: false, reason: '' };
}

/** UI ke liye counts. */
export function accessCounts(rules) {
  const r = cleanAccess(rules);
  const sum = (list) => ACCESS_KINDS.reduce((n, k) => n + r[list][k].length, 0);
  return {
    mode: r.mode,
    block: sum('block'),
    allow: sum('allow'),
    blockByKind: { ip: r.block.ip.length, user: r.block.user.length, mac: r.block.mac.length },
    allowByKind: { ip: r.allow.ip.length, user: r.allow.user.length, mac: r.allow.mac.length },
    // allowlist mode + khali allow list = sab chalta hai (UI isay warning dikhata hai)
    open: r.mode === 'allowlist' && sum('allow') === 0,
  };
}

/**
 * Ek entry add/remove karo (admin API aur tests dono yahi use karte hain).
 * @returns {{ok:boolean, rules?:object, error?:string}}
 */
export function applyAccessChange(rules, change = {}) {
  const r = cleanAccess(rules);
  const action = String(change.action || 'add');
  const list = change.list === 'allow' ? 'allow' : 'block';
  const kind = ACCESS_KINDS.includes(change.kind) ? change.kind : '';
  const value = normalizeEntry(kind, change.value);

  if (action === 'mode') {
    const mode = ACCESS_MODES.includes(change.mode) ? change.mode : 'blocklist';
    return { ok: true, rules: { ...r, mode } };
  }
  if (action === 'note') {
    return { ok: true, rules: { ...r, note: cleanText(change.note, ACCESS_NOTE_MAX) } };
  }
  if (action === 'clear') {
    return { ok: true, rules: { ...r, [list]: { ip: [], user: [], mac: [] } } };
  }
  if (!kind) return { ok: false, error: 'Kind chunein: ip, user ya mac' };
  if (!value) return { ok: false, error: `Sahi ${kind} daalein` };

  const next = { ...r, block: { ...r.block }, allow: { ...r.allow } };
  const arr = next[list][kind].slice();

  if (action === 'add') {
    if (arr.includes(value)) return { ok: true, rules: r };
    if (arr.length >= ACCESS_LIST_MAX) return { ok: false, error: `List bhar gayi (${ACCESS_LIST_MAX})` };
    arr.push(value);
    next[list][kind] = arr;
    // Aik hi waqt block aur allow mein nahi — naya add doosri list se hata deta hai
    const other = list === 'block' ? 'allow' : 'block';
    next[other][kind] = next[other][kind].filter((x) => x !== value);
    return { ok: true, rules: next };
  }
  if (action === 'remove' || action === 'removeAnywhere') {
    next[list][kind] = arr.filter((x) => x !== value);
    if (action === 'removeAnywhere') next[list === 'block' ? 'allow' : 'block'][kind] = next[list === 'block' ? 'allow' : 'block'][kind].filter((x) => x !== value);
    return { ok: true, rules: next };
  }
  return { ok: false, error: 'Unknown action' };
}

export const accessSummaryText = (rules) => {
  const c = accessCounts(rules);
  if (c.mode === 'allowlist') return c.allow ? `Allowlist — sirf ${c.allow} entries chal rahi hain` : 'Allowlist khali hai — sab chal raha hai';
  return c.block ? `Blocklist — ${c.block} entries band` : 'Koi block nahi — sab chal raha hai';
};
