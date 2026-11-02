// MIZANORA IPTV — reseller ke rules (pure code, koi Firestore/React nahi).
// Panel, API aur tests sab yahi se padhte hain, is liye price aur limit do jagah
// mukhtalif nahi ho sakte.

import { IPTV, PLANS, cleanPhone, planById } from './iptv.js';

// Reseller jo client se le sakta hai: wholesale se kam nahi, cap se zyada nahi.
export const MIN_CLIENT_PRICE = IPTV.wholesale; // 100 — is se neeche bechna nuqsan hai
export const MAX_CLIENT_PRICE = IPTV.cap;       // 200 — Mizanora ka cap

// Naye reseller ki shuruati settings (admin approve karte waqt badal sakta hai).
export const RESELLER_DEFAULTS = {
  status: 'approved',
  credit: 10,          // itni active lines bana sakta hai
  price: MAX_CLIENT_PRICE,
  months: [1, 3, 12],
};

export const MONTH_CHOICES = [1, 3, 12];

const clean = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Client ka monthly price 100–200 ke darmiyan. Ghair-number ya khali ho to cap. */
export function clientPrice(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return MAX_CLIENT_PRICE;
  if (n < MIN_CLIENT_PRICE) return MIN_CLIENT_PRICE;
  if (n > MAX_CLIENT_PRICE) return MAX_CLIENT_PRICE;
  return n;
}

/** Reseller ka munafa per line per mahina. */
export const marginOf = (price) => clientPrice(price) - IPTV.wholesale;

/** Client se kitna lena hai (price × mahine). */
export const clientTotal = (price, months = 1) => clientPrice(price) * (Number(months) || 1);

/** Reseller Mizanora ko kitna dega (wholesale × mahine × connections). */
export const wholesaleTotal = (connections = 0, months = 1) => IPTV.wholesale * Math.max(0, Number(connections) || 0) * (Number(months) || 1);

/**
 * Umeed: "naya client Rs 250 de raha hai" — system 200 par cap karta hai.
 * Purane clients ka rate kabhi nahi badalta, is liye yeh sirf NAYE client par lagta hai.
 */
export function nextClientPrice(current, requested) {
  const wanted = Math.round(Number(requested));
  const price = clientPrice(wanted);
  return { price, capped: Number.isFinite(wanted) && wanted > MAX_CLIENT_PRICE, raised: Number.isFinite(wanted) && wanted < MIN_CLIENT_PRICE };
}

/** Mahine jama karne ka sahi tareeqa (30 × din nahi — asli calendar month). */
export function addMonths(from, months) {
  const d = new Date(Number(from) || Date.now());
  const day = d.getDate();
  d.setMonth(d.getMonth() + (Number(months) || 1));
  // 31 Jan + 1 month = 28/29 Feb (JavaScript khud 3 March kar deta hai)
  if (d.getDate() < day) d.setDate(0);
  return d.getTime();
}

/** Naye client ki expiry: aaj se N mahine. */
export const clientExpiry = (months, from = Date.now()) => addMonths(from, months);

// ---------------------------------------------------------------- credentials
const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789'; // 0/O/1/l/I nahi — phone par parhna aasan ho

/** Username mz + 6 digits, password 8 characters. `rnd` tests ke liye inject hota hai. */
export function credentials(rnd = Math.random, taken = false) {
  const num = (n) => Math.floor(rnd() * n);
  const username = `mz${String(num(900000) + 100000)}`;
  let password = '';
  for (let i = 0; i < 8; i++) password += ALPHA[num(ALPHA.length)];
  return { username, password, taken };
}

// ---------------------------------------------------------------- validation
export function cleanApply(input = {}) {
  const name = clean(input.name, 60);
  const phone = cleanPhone(input.phone);
  const city = clean(input.city, 40);
  const whatsapp = cleanPhone(input.whatsapp) || phone;
  const cnic = String(input.cnic || '').replace(/\D/g, '').slice(0, 13);
  const note = clean(input.note, 300);
  const experience = ['none', 'cable', 'mobile', 'other'].includes(input.experience) ? input.experience : 'none';

  if (name.length < 3) return { ok: false, error: 'Poora naam likhein.' };
  if (!phone) return { ok: false, error: 'Sahi mobile number likhein (03XX-XXXXXXX).' };
  if (city.length < 2) return { ok: false, error: 'Shehr likhein.' };
  if (cnic && cnic.length !== 13) return { ok: false, error: 'CNIC 13 digits ka hota hai.' };
  return { ok: true, data: { name, phone, whatsapp, city, cnic, note, experience, at: Date.now() } };
}

/** Reseller apne client ki line banaye — yahan har cheez check hoti hai. */
export function cleanClient(input = {}, reseller = {}) {
  const name = clean(input.name, 60);
  const phone = cleanPhone(input.phone);
  const plan = planById(input.plan) ? input.plan : null;
  const months = MONTH_CHOICES.includes(Number(input.months)) ? Number(input.months) : 1;
  const price = clientPrice(input.price || reseller.price);
  const email = clean(input.email, 120).toLowerCase();
  const device = ['xtream', 'mag'].includes(input.device) ? input.device : 'xtream';

  if (name.length < 3) return { ok: false, error: 'Client ka naam likhein.' };
  if (!phone) return { ok: false, error: 'Client ka mobile number sahi nahi (03XX-XXXXXXX).' };
  if (!plan) return { ok: false, error: 'Plan chunein.' };
  if (plan === 'trial') return { ok: false, error: 'Trial line admin deta hai — yahan paid plan chunein.' };
  if (email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return { ok: false, error: 'Email sahi nahi (ya khali chhor dein).' };

  return {
    ok: true,
    data: {
      name, phone, email, device, plan, months, price,
      devices: planById(plan).devices,
      total: clientTotal(price, months),
      expiresAt: clientExpiry(months),
      mac: device === 'mag' ? '' : '',
    },
  };
}

/** Kya reseller ke paas aur line ki gunjaish hai? (credit = allowed active lines) */
export function canAddLine(reseller = {}, activeCount = 0) {
  const credit = Number(reseller.credit) || 0;
  const used = Math.max(0, Number(activeCount) || 0);
  if (!credit) return { ok: false, remaining: 0, error: 'Aap ka credit khatam hai — Mizanora se recharge karwayein.' };
  if (used >= credit) return { ok: false, remaining: 0, error: `Credit poora: ${used}/${credit} lines chal rahi hain. Admin se credit barhwayein.` };
  return { ok: true, remaining: credit - used };
}

// ---------------------------------------------------------------- numbers
/**
 * Reseller dashboard ke numbers. `lines` uske apne clients (iptvLines jahan resellerId = uid).
 * Note: suspended line ka paisa bhi due hota hai (line band ho to bhi mahina chalta hai).
 */
export function resellerStats(lines = [], now = Date.now()) {
  const rows = Array.isArray(lines) ? lines : [];
  let active = 0, expiring = 0, expired = 0, suspended = 0, mrr = 0, due = 0, collected = 0;

  for (const l of rows) {
    const price = clientPrice(l.price);
    const exp = Number(l.expiresAt) || 0;
    const isSuspended = l.status === 'suspended' || l.status === 'cancelled';
    if (isSuspended) { suspended++; continue; }
    if (!exp) { expired++; continue; }
    if (exp <= now) { expired++; continue; }
    active++;
    if (exp - now <= 3 * 86400e3) expiring++;
    mrr += price;
    due += IPTV.wholesale;
    collected += Number(l.paidThisCycle) || 0;
  }

  return {
    clients: rows.length,
    active, expiring, expired, suspended,
    mrr,                        // client se mahine ka
    margin: mrr - due,          // reseller ka
    due,                        // Mizanora ko dena hai
    collected,
    net: mrr - due,
  };
}

/** 1–10 cycle ka status: aaj kis din hain aur kya karna hai. */
export function cycleState(now = Date.now()) {
  const d = new Date(now);
  const day = d.getDate();
  const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const inWindow = day >= IPTV.cycle.from && day <= IPTV.cycle.to;
  const stage = day < IPTV.cycle.from ? 'before'
    : day <= IPTV.cycle.to ? 'window'
      : day < IPTV.suspendDay ? 'late'
        : 'suspend';
  const label = {
    before: `Window ${IPTV.cycle.from} tareekh se shuru hoga`,
    window: `Payment window khula — ${IPTV.cycle.to} tareekh aakhri`,
    late: `Window band — ${IPTV.suspendDay} tareekh par suspend`,
    suspend: 'Suspend din — foran payment karein',
  }[stage];
  return { day, month, inWindow, stage, label };
}

/** Payment % (0–100). */
export const collectionPct = (due, paid) => {
  const d = Number(due) || 0;
  if (!d) return 0;
  return Math.max(0, Math.min(100, Math.round(((Number(paid) || 0) / d) * 100)));
};

/** Client ko WhatsApp par bhejne wali line. Credentials sirf client ke number par. */
export function clientMessage({ name, username, password, server, plan, months, expiresAt, price, resellerName }) {
  const planName = planById(plan)?.name || 'IPTV';
  const until = new Date(Number(expiresAt) || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return [
    `Assalam o Alaikum ${name || ''},`.trim(),
    '',
    `Aap ki Mizanora IPTV line ready hai (${planName}, ${months || 1} mahina, ${until} tak).`,
    '',
    `Server: ${server || 'http://dns.mizanora.tv:8080'}`,
    `Username: ${username}`,
    `Password: ${password}`,
    '',
    'TiviMate / Smarters mein "Xtream Codes" chunein aur upar wali detail daalein.',
    `Recharge: Rs ${clientPrice(price)} mahina — ${resellerName || 'aap ka reseller'}`,
    '',
    'Shukriya — Mizanora IPTV',
  ].join('\n');
}

export { PLANS };
