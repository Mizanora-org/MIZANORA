// MIZANORA IPTV — billing ke rules (cycle 1–10, invoice, reminder, auto-suspend).
// Pure code: koi Firestore, koi network, koi email. Cron route aur admin panel dono yahi use karte hain.

import { IPTV } from './iptv.js';

export const BILLING = {
  cycle: { from: IPTV.cycle.from, to: IPTV.cycle.to },   // 1–10 tareekh
  suspendDay: IPTV.suspendDay,                           // 12 — is ke baad line band
  graceDays: 3,                                          // expiry ke baad 3 din warning
  remindBeforeDays: [7, 3, 1],
  tzOffsetMinutes: 300,                                  // Pakistan UTC+5
};

const DAY = 86_400_000;
const MIN = 60_000;

const pad = (n) => String(n).padStart(2, '0');

/** Pakistan ke hisab se saal/mahina/din (UTC+5, DST nahi). */
export function pkParts(now = Date.now()) {
  const d = new Date(Number(now) + BILLING.tzOffsetMinutes * MIN);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

export const monthKey = (now = Date.now()) => {
  const { y, m } = pkParts(now);
  return `${y}-${pad(m)}`;
};

/** Current cycle window (1st 00:00 se agle mahine ki 1st 00:00 tak), PKT. */
export function periodOf(now = Date.now()) {
  const { y, m } = pkParts(now);
  const startUtc = Date.UTC(y, m - 1, 1) - BILLING.tzOffsetMinutes * MIN;
  const endUtc = Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1) - BILLING.tzOffsetMinutes * MIN;
  return { key: `${y}-${pad(m)}`, from: startUtc, to: endUtc };
}

/** Cycle ki 10 tareekh 23:59 PKT — payment ki aakhri tareekh. */
export function dueAtFor(now = Date.now()) {
  const { y, m } = pkParts(now);
  return Date.UTC(y, m - 1, BILLING.cycle.to, 23, 59, 0) - BILLING.tzOffsetMinutes * MIN;
}

export const daysBetween = (from, to) => Math.floor((Number(to) - Number(from)) / DAY);

/**
 * Ek line ka invoice (bina kisi side effect ke). `months` default 1.
 * Amount = client ka apna price (cap ke andar) warna plan ka monthly.
 */
export function invoiceFor(line = {}, now = Date.now(), opts = {}) {
  const months = Math.max(1, Math.floor(Number(opts.months ?? line.months ?? 1) || 1));
  const price = Math.max(0, Number(line.price ?? line.amount ?? opts.price ?? 0) || 0);
  const period = periodOf(now);
  return {
    id: `${line.username || line.id || 'line'}-${period.key}`,
    lineId: line.id || '',
    username: line.username || '',
    clientName: line.clientName || line.name || '',
    phone: line.phone || '',
    resellerId: line.resellerId || '',
    months,
    amount: price * months,
    wholesale: IPTV.wholesale * months,
    currency: 'PKR',
    periodFrom: period.from,
    periodTo: period.to,
    dueAt: dueAtFor(now),
    issuedAt: Number(now),
    status: price > 0 ? 'issued' : 'free',
  };
}

/**
 * Line ki billing halat.
 * none      — expiry set nahi (manual/trial)
 * ok        — 3+ din baaqi
 * due       — 3 din ke andar expire
 * overdue   — expire ho chuki, grace ke andar
 * suspend   — grace bhi guzar gayi (cron isay band karta hai)
 * off       — suspended/cancelled (billing ka masla nahi)
 */
export function billingState(line = {}, now = Date.now(), graceDays = BILLING.graceDays) {
  const status = String(line.status || 'active');
  if (status === 'suspended' || status === 'cancelled') return { state: 'off', daysLeft: 0, daysLate: 0 };
  const exp = Number(line.expiresAt) || 0;
  if (!exp) return { state: 'none', daysLeft: 0, daysLate: 0 };

  const left = Math.ceil((exp - Number(now)) / DAY);
  if (left >= Math.max(...BILLING.remindBeforeDays)) return { state: 'ok', daysLeft: left, daysLate: 0 };
  if (left >= 0) return { state: 'due', daysLeft: left, daysLate: 0 };

  const late = Math.floor((Number(now) - exp) / DAY);
  if (late < graceDays) return { state: 'overdue', daysLeft: 0, daysLate: late };
  return { state: 'suspend', daysLeft: 0, daysLate: late };
}

const dateText = (ms) => {
  const { y, m, d } = pkParts(ms);
  return `${d}-${pad(m)}-${y}`;
};

/** WhatsApp ke liye reminder — reseller bhej sakta hai, cron bhi yahi text deta hai. */
export function reminderText(line = {}, now = Date.now(), opts = {}) {
  const st = billingState(line, now);
  const name = line.clientName || line.name || line.username || 'client';
  const amount = Math.max(0, Number(line.price) || 0) || IPTV.cap;
  const support = String(opts.support || IPTV.support).replace(/^92/, '0');
  const expiry = line.expiresAt ? dateText(line.expiresAt) : '—';

  if (st.state === 'suspend' || st.state === 'overdue') {
    return `Assalam-o-alaikum ${name}! Aap ki IPTV line ${expiry} ko khatam ho gayi thi. `
      + `Recharge ${amount} Rs — JazzCash ${support}. Payment ke foran baad line chalu ho jayegi.`;
  }
  return `Assalam-o-alaikum ${name}! Aap ki IPTV line ${expiry} ko khatam ho rahi hai (${st.daysLeft} din baaqi). `
    + `Recharge ${amount} Rs — JazzCash ${support}. Cycle ${BILLING.cycle.from}–${BILLING.cycle.to} tareekh.`;
}

/** Poori list ka khulasa — admin dashboard / cron report. */
export function billingSummary(lines = [], now = Date.now()) {
  const out = { ok: 0, due: 0, overdue: 0, suspend: 0, none: 0, off: 0, amountAtRisk: 0, lines: [] };
  for (const line of Array.isArray(lines) ? lines : []) {
    const st = billingState(line, now);
    out[st.state] = (out[st.state] || 0) + 1;
    if (st.state === 'due' || st.state === 'overdue' || st.state === 'suspend') {
      out.amountAtRisk += Math.max(0, Number(line.price) || 0);
      out.lines.push({ id: line.id, username: line.username, clientName: line.clientName || '', phone: line.phone || '',
        state: st.state, daysLeft: st.daysLeft, daysLate: st.daysLate, amount: Number(line.price) || 0,
        expiresAt: Number(line.expiresAt) || 0 });
    }
  }
  out.lines.sort((a, b) => (b.daysLate - a.daysLate) || (a.daysLeft - b.daysLeft));
  return out;
}

/** Cron ko kaun si line band karni chahiye. */
export const linesToSuspend = (lines = [], now = Date.now()) =>
  (Array.isArray(lines) ? lines : []).filter((l) => billingState(l, now).state === 'suspend');
