// MIZANORA IPTV — the shared rules of the section (prices, plans, reseller maths, validation).
// Pure code: no Firestore, no React. The pages, the API routes and the tests all read from here,
// so a price can never disagree with itself in two places.

export const IPTV = {
  name: 'Mizanora IPTV',
  short: 'IPTV',
  tagline: 'Live TV, movies aur series — Xtream, Stalker/MAC ya M3U se, kisi bhi device par.',
  // Connection fee is Rs 50 and the FIRST MONTH is included in it.
  // Of that Rs 50: Rs 20 comes to Mizanora, Rs 30 stays with the reseller.
  fee: { total: 50, admin: 20, reseller: 30 },
  // Monthly wholesale Mizanora charges the reseller for one connection.
  wholesale: 100,
  // Highest price a reseller may charge a client for a single connection, per month.
  cap: 200,
  trialHours: 24,
  cycle: { from: 1, to: 10 },       // payment window: 1st → 10th of every month
  suspendDay: 12,                    // auto-suspend after this day
  support: '923062015326',
  // What a reseller makes per client per month: what the client pays minus what Mizanora charges.
  resellerMargin: 200 - 100,
};

export const MONTHS = [
  { months: 1, label: '1 month', note: 'monthly' },
  { months: 3, label: '3 months', note: 'save 8%' },
  { months: 12, label: '12 months', note: 'save 21%' },
];

export const PLANS = [
  {
    id: 'trial',
    name: 'Free trial',
    for: 'Pehle dekh lein',
    devices: 1,
    quality: 'HD',
    priced: { 1: 0, 3: 0, 12: 0 },
    trial: true,
    includes: ['24 ghante, 1 device', 'Standard channels', 'Xtream ya MAC — dono', 'Koi card nahi, koi auto-charge nahi'],
  },
  {
    id: 'starter',
    name: 'Starter',
    for: 'Aik TV, aik phone',
    devices: 1,
    quality: 'HD',
    priced: { 1: 200, 3: 550, 12: 1900 },
    includes: ['1 connection', 'HD live channels', 'EPG guide + favourites', 'WhatsApp support'],
  },
  {
    id: 'family',
    name: 'Family',
    for: 'Ghar ke do screens',
    devices: 2,
    quality: 'FHD',
    priced: { 1: 350, 3: 950, 12: 3350 },
    popular: true,
    includes: ['2 connections', 'FHD channels', 'Movies + series (VOD)', '2 devices ek saath'],
  },
  {
    id: 'premium',
    name: 'Premium',
    for: 'Sports + 4K fans',
    devices: 3,
    quality: '4K',
    priced: { 1: 500, 3: 1350, 12: 4800 },
    includes: ['3 connections', '4K jahan available ho', 'Sports + movies + series', 'Priority support'],
  },
];

export const FEATURES = [
  ['Tv', 'Har device par', 'TiviMate, IPTV Smarters, Smart TV, MAG box, Fire Stick, phone ya browser — jo hai wohi chalega.'],
  ['CalendarClock', 'Poora EPG', 'Har channel ki 7-din guide, now/next aur catch-up — guide khaali nahi milti.'],
  ['Zap', 'Tez channel switch', 'Playlist edge se aati hai, is liye channel badalne mein ~1 second lagta hai.'],
  ['ShieldCheck', 'Line lock', 'Aik plan = tay devices. Password share karna bekaar — device limit server par lagti hai.'],
  ['MonitorSmartphone', 'Xtream + MAC', 'Username/password chahiye ya MAC address — dono support hain, ek hi line par.'],
  ['Wallet', 'Aasan recharge', 'JazzCash, Easypaisa ya bank se apne reseller ko pay karein — line foran chalu.'],
];

export const HOW = [
  ['Plan chunein', 'Rs 50 connection fee (pehla month isme shamil) — uske baad Rs 200 mahina.'],
  ['Reseller se line lein', 'Woh aap ka username/password ya MAC banata hai — 2 minute ka kaam.'],
  ['App mein daalein', 'Xtream login ya MAC portal — TiviMate, Smarters, Smart TV, MAG box.'],
  ['Watch karein', 'Channels, movies aur series — 2 devices tak ek saath (plan ke hisaab se).'],
];

export const FAQ = [
  ['Mizanora IPTV kya hai?', 'Ye Mizanora ka TV section hai: live channels, movies aur series. Aap Xtream Codes (username + password) ya Stalker/MAC portal se apne TV, phone ya box par chalate hain. Mizanora khud channels, guide aur billing manage karta hai.'],
  ['Connection fee aur monthly charge kitna hai?', `Nayi line par Rs ${IPTV.fee.total} connection fee hai — pehla month isme shamil hai. Uske baad Rs ${IPTV.cap} mahina (reseller is se zyada nahi le sakta). Reseller ko Mizanora Rs ${IPTV.wholesale} mahina deta hai.`],
  ['Kaunse device chalte hain?', 'Android TV / Google TV, Fire TV Stick, Samsung Tizen, LG webOS, MAG/Stalker boxes, iPhone/iPad, Android phone aur browser. Har device par wohi Xtream login ya MAC chalta hai.'],
  ['Trial milta hai?', `Haan — ${IPTV.trialHours} ghante ka free trial, 1 device. Trial par koi charge nahi aur koi card save nahi hota.`],
  ['Payment kaise hota hai?', `Har mahine ${IPTV.cycle.from}–${IPTV.cycle.to} tareekh ke darmiyan apne reseller ko JazzCash, Easypaisa ya bank se pay karein. Reseller apni number panel mein set karta hai — wohi number aur wohi naam aap ko recharge screen par dikhta hai.`],
  ['Line band ho jaye to?', `Payment na aane par ${IPTV.suspendDay} tareekh ke baad line suspend ho jati hai aur aap ke TV par recharge screen chalti hai — us par aap ke reseller ka naam aur number hota hai. Payment ke foran baad line wapas chalu.`],
  ['Channels legal hain?', 'Mizanora sirf woh channels dikhata hai jinke liye operator ke paas ijazat hai (apne channels, official/free-to-air streams ya written distribution rights). Kisi bhi channel ka haq na hone par woh list se hata diya jata hai.'],
];

// Reseller side: what each pack gives and what it costs.
export const RESELLER_PACKS = [
  { id: 'trial', name: 'Trial reseller', price: 0, connections: 2, note: '7 din, test karne ke liye' },
  { id: 'starter', name: 'Starter', price: 1000, connections: 10, note: 'pehla pack' },
  { id: 'growth', name: 'Growth', price: 5000, connections: 50, bonus: 5 },
  { id: 'pro', name: 'Pro', price: 9000, connections: 100, bonus: 15 },
];

export const RESELLER_RULES = [
  ['Rs 30 per connection', `Nayi line par client se Rs ${IPTV.fee.total} — Rs ${IPTV.fee.reseller} aap ka, Rs ${IPTV.fee.admin} Mizanora ka. Pehla month isme shamil.`],
  ['Rs 100 per month', `Har chalti line par client se Rs ${IPTV.cap} — Rs ${IPTV.wholesale} Mizanora ko, Rs ${IPTV.resellerMargin} aap ka.`],
  ['Unlimited clients', 'Register hone ke baad jitne clients chahiye banayein — koi limit nahi, koi extra fee nahi.'],
  ['Apni price, cap ke andar', `Aap apni price set karte hain, magar Rs ${IPTV.cap} mahina se zyada nahi — client ko overcharge nahi kiya ja sakta.`],
  ['Khud ka payment number', 'JazzCash, Easypaisa ya bank — jo aap ka ho. Client ko recharge screen par wohi dikhta hai.'],
  ['1–10 collection', 'Mizanora aap se mahine ki 1 se 10 tareekh ke darmiyan wasooli karta hai (JazzCash 0306-2015326). 12 tareekh tak na aaye to lines auto-suspend.'],
];

// ---------------------------------------------------------------- helpers
export const planById = (id) => PLANS.find((p) => p.id === id) || null;
export const planPrice = (plan, months = 1) => {
  const p = planById(plan) || PLANS[1];
  return p.priced[months] ?? p.priced[1];
};
export const monthlyEquivalent = (plan, months) => {
  const total = planPrice(plan, months);
  return months ? Math.round(total / months) : 0;
};
export const pkr = (n) => `Rs ${Number(n || 0).toLocaleString('en-PK')}`;

const digits = (s) => String(s || '').replace(/\D/g, '');
const clean = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

/** A Pakistani mobile number in 03XXXXXXXXX form, or ''. Accepts +92 / 92 / 0092. */
export function cleanPhone(v) {
  let d = digits(v);
  if (d.startsWith('0092')) d = d.slice(4);
  else if (d.startsWith('92') && d.length > 11) d = d.slice(2);
  if (d.startsWith('3') && d.length === 10) d = `0${d}`;
  return /^03\d{9}$/.test(d) ? d : '';
}

// Hex only (digits() strips A-F, which would quietly wreck a MAC address).
const hex = (s) => String(s == null ? '' : s).toUpperCase().replace(/[^0-9A-F]/g, '');

/** MAC for a Stalker/MAG line: 00:1A:79:XX:XX:XX (the OUI every portal expects). */
export const cleanMac = (v) => {
  const d = hex(v);
  if (d.length !== 12) return '';
  const mac = d.match(/.{2}/g).join(':');
  return /^00:1A:79:/.test(mac) ? mac : `00:1A:79:${d.slice(6).match(/.{2}/g).join(':')}`;
};
export const randomMac = () => {
  const r = () => Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0');
  return `00:1A:79:${r()}:${r()}:${r()}`;
};

/** Server-side validation for the public trial form. */
export function cleanTrial(input = {}) {
  const name = clean(input.name, 60);
  const phone = cleanPhone(input.phone);
  const city = clean(input.city, 40);
  const device = ['xtream', 'mag', 'smarttv', 'phone'].includes(input.device) ? input.device : 'xtream';
  const plan = planById(input.plan) ? input.plan : 'starter';
  if (name.length < 3) return { ok: false, error: 'Apna poora naam likhein.' };
  if (!phone) return { ok: false, error: 'Sahi mobile number likhein (03XX-XXXXXXX).' };
  if (city.length < 2) return { ok: false, error: 'Shehr ka naam likhein.' };
  return { ok: true, data: { name, phone, city, device, plan, at: Date.now() } };
}

/** active | expiring (3 days or less) | expired */
export function lineState(expiresAt, now = Date.now()) {
  const t = Number(expiresAt) || 0;
  if (!t) return { state: 'none', days: 0, label: 'No line' };
  const days = Math.ceil((t - now) / 86400000);
  if (days <= 0) return { state: 'expired', days, label: 'Expired' };
  if (days <= 3) return { state: 'expiring', days, label: `${days} din baqi` };
  return { state: 'active', days, label: `${days} din baqi` };
}

/** The WhatsApp message a client sends to their reseller to renew. */
export const renewMessage = (line = {}) =>
  `Assalam o Alaikum, mujhe Mizanora IPTV line renew karni hai (${line.username || line.mac || 'meri line'}). ` +
  `Plan: ${planById(line.plan)?.name || 'Starter'}. Shukriya.`;
