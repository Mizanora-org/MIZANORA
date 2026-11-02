// ANALYTICS — events/sessions se numbers. Pure functions: test ho sakte hain, Firestore nahi chahiye.
const DAY = 86400e3;
const dayKey = (t) => new Date(Number(t) || 0).toISOString().slice(0, 10);

/** Aakhri `days` din ke plays/logins — chart ke liye. */
export function dailySeries(events = [], days = 14, now = Date.now()) {
  const n = Math.min(60, Math.max(1, Number(days) || 14));
  const rows = [];
  const map = new Map();
  for (let i = n - 1; i >= 0; i--) {
    const t = now - i * DAY;
    const key = dayKey(t);
    const row = { day: key, plays: 0, logins: 0, events: 0 };
    map.set(key, row);
    rows.push(row);
  }
  for (const e of Array.isArray(events) ? events : []) {
    const row = map.get(dayKey(e.at));
    if (!row) continue;
    row.events++;
    if (e.type === 'stream_start') row.plays++;
    else if (e.type === 'login') row.logins++;
  }
  return rows;
}

const tally = (items, key) => {
  const m = new Map();
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

/** Sab se zyada chalne wale channels/movies. */
export const topContent = (events = [], n = 10) => tally(events.filter((e) => e.type === 'stream_start' && e.channel), (e) => String(e.channel)).slice(0, n).map(([name, plays]) => ({ name, plays }));

/** Kaun se apps chal rahe hain. */
export const topApps = (events = [], n = 8) => tally(events.filter((e) => e.app), (e) => String(e.app)).slice(0, n).map(([name, n2]) => ({ name, n: n2 }));

/** Reseller ke hisab se lines / online / plays. */
export function byReseller(lines = [], events = [], online = []) {
  const m = new Map();
  const key = (id, name) => (id ? (name || id) : 'Mizanora (admin)');
  for (const l of Array.isArray(lines) ? lines : []) {
    const k = key(l.resellerId, l.resellerName);
    const row = m.get(k) || { reseller: k, lines: 0, active: 0, suspended: 0, online: 0, plays: 0 };
    row.lines++;
    if (l.status === 'suspended' || l.status === 'cancelled') row.suspended++;
    else if (Number(l.expiresAt) > Date.now()) row.active++;
    m.set(k, row);
  }
  for (const s of Array.isArray(online) ? online : []) {
    const k = key(s.resellerId, '');
    const row = m.get(k) || { reseller: k, lines: 0, active: 0, suspended: 0, online: 0, plays: 0 };
    row.online++;
    m.set(k, row);
  }
  for (const e of Array.isArray(events) ? events : []) {
    if (e.type !== 'stream_start') continue;
    const k = key(e.resellerId, '');
    const row = m.get(k);
    if (row) row.plays++;
  }
  return [...m.values()].sort((a, b) => b.lines - a.lines);
}

/** Line par aakhri device/app/channel — admin table ke liye. */
export function lineActivity(line = {}, sessions = {}) {
  const s = sessions[line.username] || sessions[line.id] || null;
  if (!s) return { online: false, app: '', channel: '', ip: '', device: '', lastSeen: 0 };
  const lastSeen = Number(s.lastSeen) || 0;
  return {
    online: Date.now() - lastSeen < 5 * 60_000,
    app: s.app || '',
    channel: s.channel || '',
    ip: s.ip || '',
    device: s.device || '',
    kind: s.kind || '',
    lastSeen,
  };
}

/** Poore panel ke KPI ek jagah. */
export function overview({ events = [], lines = [], online = [], resellers = [] } = {}, now = Date.now()) {
  const ev = Array.isArray(events) ? events : [];
  const ln = Array.isArray(lines) ? lines : [];
  const on = Array.isArray(online) ? online : [];
  const active = ln.filter((l) => (l.status || 'active') === 'active' && (!l.expiresAt || Number(l.expiresAt) > now));
  const expiring = ln.filter((l) => Number(l.expiresAt) > now && Number(l.expiresAt) - now < 4 * DAY);
  return {
    lines: ln.length,
    active: active.length,
    expiring: expiring.length,
    expired: ln.filter((l) => Number(l.expiresAt) && Number(l.expiresAt) <= now).length,
    suspended: ln.filter((l) => l.status === 'suspended' || l.status === 'cancelled').length,
    resellers: Array.isArray(resellers) ? resellers.length : 0,
    online: on.filter((s) => now - (Number(s.lastSeen) || 0) < 5 * 60_000).length,
    devices: on.reduce((n, s) => n + (Number(s.devices) || 0), 0),
    plays24h: ev.filter((e) => e.type === 'stream_start' && now - (Number(e.at) || 0) < DAY).length,
    logins24h: ev.filter((e) => e.type === 'login' && now - (Number(e.at) || 0) < DAY).length,
  };
}
