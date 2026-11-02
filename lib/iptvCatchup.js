// MIZANORA IPTV — 7-din catch-up (timeshift) ke rules. Pure code, koi network nahi.
//
// Channel ke paas archive ho to app/purana programme dobara chal sakta hai:
//   /timeshift/<user>/<pass>/<minutes>/<YYYY-MM-DD:HH-MM>/<channel>[.ts]
// Hum wohi Xtream-style path dete hain, aur andar wala asli archive URL sealed rehta hai.

export const CATCHUP_MAX_DAYS = 7;
export const CATCHUP_MIN_PAST_SEC = 45;        // itne second pehle tak hi "past" mana jata hai
export const CATCHUP_MAX_MINUTES = 180;        // ek request mein max 3 ghante
export const CATCHUP_DEFAULT_MINUTES = 60;

/** Channel par kitne din ka archive hai (0 = nahi). */
export function archiveDaysFor(ch) {
  if (!ch) return 0;
  const raw = [ch.archive, ch.catchup, ch.tvArchive, ch.tv_archive, ch.catchupDays].find((v) => v !== undefined && v !== null && v !== '');
  if (raw === true) return CATCHUP_MAX_DAYS;   // import sirf "archive hai" batata hai
  const n = Math.floor(Number(raw) || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, CATCHUP_MAX_DAYS);
}

export const hasCatchup = (ch) => archiveDaysFor(ch) > 0;

/**
 * Xtream/Stalker clients `YYYY-MM-DD:HH-MM` bhejte hain; browser se epoch second/millis bhi aata hai.
 * @returns {number} epoch ms, ya 0
 */
export function parseStart(value) {
  const s = String(value || '').trim();
  if (!s) return 0;
  const stamp = s.match(/^(\d{4})-(\d{2})-(\d{2})[T: ](\d{2})[-:](\d{2})(?:[-:](\d{2}))?/);
  if (stamp) {
    const [, y, mo, d, h, mi, sec] = stamp;
    const ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(sec || 0));
    return Number.isFinite(ms) ? ms : 0;
  }
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    // 13 digits = millis, 10 digits = seconds
    return n > 1e12 ? n : n > 1e9 ? n * 1000 : 0;
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Catch-up window valid hai ya nahi.
 * @returns {{ok:boolean, error?:string, start:number, end:number, minutes:number, days:number}}
 */
export function catchupWindow(startValue, opts = {}) {
  const now = Number(opts.now) || Date.now();
  const days = Math.min(Math.max(1, Math.floor(Number(opts.days) || CATCHUP_MAX_DAYS)), CATCHUP_MAX_DAYS);
  const wanted = Math.floor(Number(opts.minutes) || CATCHUP_DEFAULT_MINUTES);
  const minutes = Math.min(Math.max(5, wanted), CATCHUP_MAX_MINUTES);
  const start = parseStart(startValue);

  if (!start) return { ok: false, error: 'Start time samajh nahi aaya', start: 0, end: 0, minutes, days };
  const end = Math.min(start + minutes * 60_000, now - CATCHUP_MIN_PAST_SEC * 1000);
  if (start > now - CATCHUP_MIN_PAST_SEC * 1000) {
    return { ok: false, error: 'Future ka catch-up nahi milta — sirf pichhle programmes.', start, end: 0, minutes, days };
  }
  if (start < now - days * 86_400_000) {
    return { ok: false, error: `Sirf ${days} din ka archive hai — is se purana programme available nahi.`, start, end: 0, minutes, days };
  }
  if (end - start < 60_000) {
    return { ok: false, error: 'Yeh programme abhi shuru hua hai — 1 minute baad try karein.', start, end: 0, minutes, days };
  }
  return { ok: true, start, end, minutes: Math.round((end - start) / 60_000), days };
}

/**
 * Archive ka asli URL banao.
 * - `{utc}` `{lutc}` `{start}` `{end}` `{dur}` placeholders ho to woh bhar do (jo provider maange).
 * - Warna standard Xtream query: `?utc=<startSec>&lutc=<endSec>`.
 * - `{start}`/`{end}` millis mein, `{utc}`/`{lutc}` seconds mein, `{dur}` minutes mein.
 */
export function timeshiftUrl(baseUrl, startMs, endMs) {
  const url = String(baseUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) return '';
  const s = Math.floor(Number(startMs) / 1000);
  const e = Math.floor(Number(endMs) / 1000);
  if (!(s > 0) || !(e >= s)) return '';
  if (/\{(utc|lutc|start|end|dur)\}/i.test(url)) {
    return url
      .replace(/\{utc\}/gi, String(s))
      .replace(/\{lutc\}/gi, String(e))
      .replace(/\{start\}/gi, String(startMs))
      .replace(/\{end\}/gi, String(endMs))
      .replace(/\{dur\}/gi, String(Math.max(1, Math.round((e - s) / 60))));
  }
  return `${url}${url.includes('?') ? '&' : '?'}utc=${s}&lutc=${e}`;
}

/** Guide ke liye ek line ka label. */
export const catchupLabel = (days) => (days > 0 ? `${days}-din catch-up` : 'No catch-up');
