// SHOP HOURS (v24). Pure code, used by the admin page, the server and the browser.
// The admin sets when the shop is OPEN (Pakistan time). Outside those hours visitors see the "shop is closed" screen with the live
// Quran recitation, and the shop opens again by itself. An EMERGENCY CLOSE (Admin > Control > Shut down) stays separate and wins over the hours.
// Nothing is written per visitor: the browser works out open / closed from the clock, so no Firebase reads are needed.

const hhmm = (v, d) => { const m = String(v || '').match(/^(\d{1,2}):(\d{2})$/); if (!m) return d; const h = Number(m[1]); const mi = Number(m[2]); return h > 23 || mi > 59 ? d : `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`; };
const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

export const DEFAULT_HOURS = { enabled: false, open: '09:00', close: '23:00', days: [], closedMessage: '' };

export function cleanHours(x) {
  const h = x && typeof x === 'object' ? x : {};
  const days = [...new Set((Array.isArray(h.days) ? h.days : []).map((d) => Math.floor(Number(d))).filter((d) => d >= 0 && d <= 6))].sort();
  return {
    enabled: h.enabled === true,
    open: hhmm(h.open, DEFAULT_HOURS.open),
    close: hhmm(h.close, DEFAULT_HOURS.close),
    days, // days the shop is open (0 = Sunday ... 6 = Saturday). Empty = every day.
    closedMessage: String(h.closedMessage || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200),
  };
}

// Pakistan has no daylight saving: always UTC+5.
export function karachi(now = Date.now()) {
  const t = new Date(Number(now) + 5 * 3600e3);
  return { dow: t.getUTCDay(), minutes: t.getUTCHours() * 60 + t.getUTCMinutes() };
}

// { open, why, nextOpenText } - why: 'always' | 'hours' | 'closed-hours' | 'closed-day'
export function shopOpenNow(hoursIn, now = Date.now()) {
  const h = cleanHours(hoursIn);
  if (!h.enabled) return { open: true, why: 'always' };
  const a = toMin(h.open); const b = toMin(h.close);
  const { dow, minutes } = karachi(now);
  const dayOk = (d) => !h.days.length || h.days.includes(d);
  if (a === b) return { open: dayOk(dow), why: dayOk(dow) ? 'hours' : 'closed-day', nextOpenText: h.open }; // same time = open all day on the open days
  const wraps = b < a; // for example 18:00 to 02:00
  const inside = wraps ? minutes >= a || minutes < b : minutes >= a && minutes < b;
  if (inside) {
    const startDay = wraps && minutes < b ? (dow + 6) % 7 : dow; // after midnight the shift belongs to the day it started
    if (dayOk(startDay)) return { open: true, why: 'hours' };
    return { open: false, why: 'closed-day', nextOpenText: h.open };
  }
  return { open: false, why: 'closed-hours', nextOpenText: h.open };
}

export const to12h = (s) => { const [h, m] = String(s).split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`; };
export const describeHours = (hoursIn) => {
  const h = cleanHours(hoursIn);
  if (!h.enabled) return 'Open 24 hours (no shop hours set).';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `Open ${to12h(h.open)} to ${to12h(h.close)} (Pakistan time), ${h.days.length ? h.days.map((d) => names[d]).join(', ') : 'every day'}.`;
};
