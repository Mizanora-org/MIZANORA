// Pure maths and text logic for the tools (no React, no browser needed) so the tests can check every formula. v25.

// ---- safe calculator: its own parser, never eval() ----
export function calc(expr) {
  const src = String(expr || '').toLowerCase().replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
  if (!src) return { ok: false, error: 'Type a sum' };
  if (src.length > 200) return { ok: false, error: 'Too long' };
  let i = 0;
  const fn = { sqrt: Math.sqrt, sin: (x) => Math.sin(x * Math.PI / 180), cos: (x) => Math.cos(x * Math.PI / 180), tan: (x) => Math.tan(x * Math.PI / 180), log: Math.log10, ln: Math.log, abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round };
  const peek = () => src[i];
  function num() {
    const m = src.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/);
    if (!m) throw new Error('Unexpected "' + (src[i] || 'end') + '"');
    i += m[0].length; return Number(m[0]);
  }
  function atom() {
    const c = peek();
    if (c === '(') { i++; const v = add(); if (peek() !== ')') throw new Error('Missing )'); i++; return v; }
    if (c === '-') { i++; return -pow(); }
    if (c === '+') { i++; return pow(); }
    const w = src.slice(i).match(/^[a-z]+/);
    if (w) {
      const name = w[0]; i += name.length;
      if (name === 'pi') return Math.PI;
      if (name === 'e') return Math.E;
      if (!fn[name]) throw new Error('Unknown "' + name + '"');
      if (peek() !== '(') throw new Error(name + ' needs ( )');
      i++; const v = add(); if (peek() !== ')') throw new Error('Missing )'); i++; return fn[name](v);
    }
    return num();
  }
  function post() { let v = atom(); while (peek() === '%') { i++; v /= 100; } return v; }
  function pow() { const b = post(); if (peek() === '^') { i++; return Math.pow(b, pow()); } return b; }
  function mul() { let v = pow(); for (;;) { const c = peek(); if (c === '*') { i++; v *= pow(); } else if (c === '/') { i++; v /= pow(); } else if (c === '(' || /[a-z\d.]/.test(c || '')) { v *= pow(); } else return v; } }
  function add() { let v = mul(); for (;;) { const c = peek(); if (c === '+') { i++; v += mul(); } else if (c === '-') { i++; v -= mul(); } else return v; } }
  try {
    const v = add();
    if (i < src.length) throw new Error('Unexpected "' + src[i] + '"');
    if (!Number.isFinite(v)) return { ok: false, error: 'Not a number' };
    return { ok: true, value: Math.round(v * 1e10) / 1e10 };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ---- money and business ----
export const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/[, ]/g, '')); return Number.isFinite(n) ? n : 0; };
export const money = (n) => (Number.isFinite(n) ? n.toLocaleString('en-PK', { maximumFractionDigits: 2 }) : '0');

export const GRAMS_PER_TOLA = 11.664;
export const NISAB_SILVER_G = 612.36; // 52.5 tola
export const NISAB_GOLD_G = 87.48;    // 7.5 tola
export function zakat({ cash = 0, goldG = 0, silverG = 0, goldPerG = 0, silverPerG = 0, business = 0, receivable = 0, other = 0, debts = 0, basis = 'silver' }) {
  const assets = num(cash) + num(goldG) * num(goldPerG) + num(silverG) * num(silverPerG) + num(business) + num(receivable) + num(other);
  const net = Math.max(0, assets - num(debts));
  const nisabG = basis === 'gold' ? NISAB_GOLD_G : NISAB_SILVER_G;
  const price = basis === 'gold' ? num(goldPerG) : num(silverPerG);
  const nisabValue = nisabG * price;
  const known = price > 0;
  const due = known && net >= nisabValue && net > 0;
  return { assets, net, nisabValue, known, due, zakat: due ? net * 0.025 : 0 };
}
export const percentOf = (p, n) => (num(p) * num(n)) / 100;
export const whatPercent = (a, b) => (num(b) ? (num(a) / num(b)) * 100 : 0);
export const percentChange = (a, b) => (num(a) ? ((num(b) - num(a)) / Math.abs(num(a))) * 100 : 0);
export function discount(price, d1, d2 = 0) {
  const p = num(price); const a = p - (p * num(d1)) / 100; const f = a - (a * num(d2)) / 100;
  return { final: f, saved: p - f, total: p ? ((p - f) / p) * 100 : 0 };
}
export function margin(cost, sell) {
  const c = num(cost), s = num(sell), p = s - c;
  return { profit: p, margin: s ? (p / s) * 100 : 0, markup: c ? (p / c) * 100 : 0 };
}
export function emi(principal, annualRate, months) {
  const P = num(principal), n = Math.max(1, Math.floor(num(months))), r = num(annualRate) / 12 / 100;
  const m = r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return { emi: m, total: m * n, interest: m * n - P };
}
export function bmi(kg, cm) {
  const h = num(cm) / 100; if (!h || !num(kg)) return null;
  const v = num(kg) / (h * h);
  const cat = v < 18.5 ? 'Underweight' : v < 25 ? 'Normal' : v < 30 ? 'Overweight' : 'Obese';
  return { bmi: v, cat };
}
export function tax(amount, rate, inclusive) {
  const a = num(amount), r = num(rate) / 100;
  if (inclusive) { const base = a / (1 + r); return { base, tax: a - base, total: a }; }
  return { base: a, tax: a * r, total: a * (1 + r) };
}
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const below100 = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : ''));
const below1000 = (n) => (n >= 100 ? ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + below100(n % 100) : '') : below100(n));
export function toWords(n) {
  n = Math.floor(Math.abs(num(n)));
  if (n === 0) return 'zero';
  if (n >= 1e12) return 'too large';
  const parts = [];
  const arab = Math.floor(n / 1e9); n %= 1e9;
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const th = Math.floor(n / 1e3); n %= 1e3;
  if (arab) parts.push(below1000(arab) + ' arab');
  if (crore) parts.push(below100(crore) + ' crore');
  if (lakh) parts.push(below100(lakh) + ' lakh');
  if (th) parts.push(below100(th) + ' thousand');
  if (n) parts.push(below1000(n));
  return parts.join(' ');
}
export function rupeesInWords(v) {
  const x = Math.abs(num(v)); const r = Math.floor(x); const p = Math.round((x - r) * 100);
  if (r >= 1e12) return 'Too large';
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  return `${num(v) < 0 ? 'Minus ' : ''}${cap(toWords(r))} rupees${p ? ' and ' + toWords(p) + ' paisa' : ''} only`;
}

// ---- units ----
export const UNITS = {
  Land: { base: 'sq ft', u: { 'sq ft': 1, 'sq yard': 9, 'sq meter': 10.7639104167, marla: 272.25, kanal: 5445, acre: 43560, hectare: 107639.104167, murabba: 1089000 } },
  Gold: { base: 'gram', u: { gram: 1, kilogram: 1000, tola: GRAMS_PER_TOLA, masha: GRAMS_PER_TOLA / 12, ratti: GRAMS_PER_TOLA / 96, 'ounce (troy)': 31.1034768 } },
  Length: { base: 'meter', u: { meter: 1, kilometer: 1000, centimeter: 0.01, millimeter: 0.001, inch: 0.0254, foot: 0.3048, yard: 0.9144, mile: 1609.344, gaz: 0.9144 } },
  Weight: { base: 'kg', u: { kg: 1, gram: 0.001, pound: 0.45359237, ounce: 0.028349523, seer: 0.9331, maund: 37.3242, 'ton (metric)': 1000 } },
  Volume: { base: 'liter', u: { liter: 1, milliliter: 0.001, 'cup (US)': 0.2365882365, 'gallon (US)': 3.785411784, 'fluid ounce (US)': 0.0295735296 } },
  Temperature: { base: 'celsius', u: { celsius: 1, fahrenheit: 1, kelvin: 1 } },
};
export function convertUnit(group, from, to, value) {
  const v = Number(value); if (!Number.isFinite(v)) return NaN;
  if (group === 'Temperature') {
    const c = from === 'fahrenheit' ? (v - 32) * 5 / 9 : from === 'kelvin' ? v - 273.15 : v;
    return to === 'fahrenheit' ? c * 9 / 5 + 32 : to === 'kelvin' ? c + 273.15 : c;
  }
  const g = UNITS[group]; if (!g || !g.u[from] || !g.u[to]) return NaN;
  return (v * g.u[from]) / g.u[to];
}

// ---- dates (Hijri uses the Umm al-Qura calendar of the browser) ----
export function hijriOf(date, offsetDays = 0) {
  try {
    const d = new Date(date.getTime() + offsetDays * 86400000);
    const p = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(d);
    const g = (t) => Number((p.find((x) => x.type === t) || {}).value);
    const r = { day: g('day'), month: g('month'), year: g('year') };
    return r.day && r.month && r.year ? r : null;
  } catch { return null; }
}
export function gregorianFromHijri(y, m, d, offsetDays = 0) {
  const approx = Date.UTC(Math.round(y * 0.970229 + 621.5746), 5, 15);
  for (let k = -420; k <= 420; k++) {
    const t = new Date(approx + k * 86400000);
    const h = hijriOf(t, offsetDays);
    if (h && h.year === y && h.month === m && h.day === d) return t;
  }
  return null;
}
export function ageOf(dob, now = new Date()) {
  const b = new Date(dob); if (isNaN(b)) return null;
  let y = now.getUTCFullYear() - b.getUTCFullYear(), m = now.getUTCMonth() - b.getUTCMonth(), d = now.getUTCDate() - b.getUTCDate();
  if (d < 0) { m--; d += new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).getUTCDate(); }
  if (m < 0) { y--; m += 12; }
  const days = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())) / 86400000);
  let next = Date.UTC(now.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  if (next < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) next = Date.UTC(now.getUTCFullYear() + 1, b.getUTCMonth(), b.getUTCDate());
  return { years: y, months: m, days: d, totalDays: days, nextBirthdayIn: Math.round((next - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86400000) };
}
export function daysBetween(a, b) {
  const x = new Date(a), y = new Date(b); if (isNaN(x) || isNaN(y)) return null;
  const d = Math.round((Date.UTC(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate()) - Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())) / 86400000);
  return { days: d, weeks: d / 7, months: d / 30.4375 };
}

// ---- Qibla ----
export const KAABA = { lat: 21.422487, lng: 39.826206 };
export function qibla(lat, lng) {
  const r = Math.PI / 180, f1 = lat * r, f2 = KAABA.lat * r, dl = (KAABA.lng - lng) * r;
  const y = Math.sin(dl) * Math.cos(f2), x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  const bearing = (Math.atan2(y, x) / r + 360) % 360;
  const a = Math.sin((f2 - f1) / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  return { bearing, km: 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a))) };
}

// ---- developer helpers ----
export function chmod({ r = [0, 0, 0], w = [0, 0, 0], x = [0, 0, 0] }) {
  const d = [0, 1, 2].map((i) => (r[i] ? 4 : 0) + (w[i] ? 2 : 0) + (x[i] ? 1 : 0));
  const sym = [0, 1, 2].map((i) => (r[i] ? 'r' : '-') + (w[i] ? 'w' : '-') + (x[i] ? 'x' : '-')).join('');
  return { octal: d.join(''), symbolic: sym };
}
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const two = (v) => String(v).padStart(2, '0');
function cronPart(v, unit, names) {
  if (v === '*') return `every ${unit}`;
  if (/^\*\/\d+$/.test(v)) return `every ${v.slice(2)} ${unit}s`;
  if (/^\d+-\d+$/.test(v)) { const [a, b] = v.split('-'); return `${unit} ${names ? names[a] : a} to ${names ? names[b] : b}`; }
  if (/^[\d,]+$/.test(v)) return `${unit} ${v.split(',').map((x) => (names ? names[Number(x)] : x)).join(', ')}`;
  return `${unit} ${v}`;
}
export function cronText(expr) {
  const f = String(expr || '').trim().split(/\s+/);
  if (f.length !== 5) return 'A cron expression has exactly 5 fields.';
  const [mi, h, dom, mo, dow] = f;
  if (!f.every((x) => /^[\d*,/\-]+$/.test(x))) return 'Only numbers, * , - and / are understood here.';
  let when;
  if (/^\d+$/.test(mi) && /^\d+$/.test(h)) when = `At ${two(h)}:${two(mi)}`;
  else if (mi.startsWith('*/') && h === '*') when = `Every ${mi.slice(2)} minutes`;
  else if (mi === '*' && h === '*') when = 'Every minute';
  else when = `${cronPart(mi, 'minute')}, ${cronPart(h, 'hour')}`;
  const parts = [when];
  if (dom !== '*') parts.push(cronPart(dom, 'day of month'));
  if (mo !== '*') parts.push('in ' + cronPart(mo, 'month', MONTHS).replace(/^month /, ''));
  if (dow !== '*') parts.push('on ' + cronPart(dow, 'day', DAYS).replace(/^day /, ''));
  return parts.join(', ');
}
export const b64 = {
  enc: (s) => { const b = new TextEncoder().encode(s); let t = ''; b.forEach((c) => { t += String.fromCharCode(c); }); return btoa(t); },
  dec: (s) => { const t = atob(String(s).trim().replace(/-/g, '+').replace(/_/g, '/')); return new TextDecoder().decode(Uint8Array.from(t, (c) => c.charCodeAt(0))); },
};
export function hexToRgb(h) {
  let s = String(h || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
}
export const rgbToHex = ({ r, g, b }) => '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
export function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}
export function hslToRgb({ h, s, l }) {
  s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(255 * f(0)), g: Math.round(255 * f(8)), b: Math.round(255 * f(4)) };
}

// ---- text and SEO ----
export function slugify(s, max = 80) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '');
}
export function textStats(t) {
  const s = String(t || ''); const words = (s.match(/\S+/g) || []).length;
  return { words, chars: s.length, noSpaces: s.replace(/\s/g, '').length, sentences: (s.match(/[^.!?۔]+[.!?۔]+/g) || (s.trim() ? [s] : [])).length, lines: s ? s.split('\n').length : 0, minutes: Math.max(words ? 1 : 0, Math.ceil(words / 200)) };
}
export function caseConvert(s, mode) {
  const t = String(s || '');
  if (mode === 'upper') return t.toUpperCase();
  if (mode === 'lower') return t.toLowerCase();
  if (mode === 'title') return t.toLowerCase().replace(/(^|[\s\-(])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  if (mode === 'sentence') return t.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
  if (mode === 'camel') return t.toLowerCase().replace(/[^a-z0-9]+(.)?/g, (m, c) => (c ? c.toUpperCase() : ''));
  if (mode === 'snake') return t.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (mode === 'kebab') return slugify(t, 200);
  return t;
}
const KW_PRE = ['best', 'cheap', 'top', 'buy', 'online', 'new', 'latest', 'free', 'how to', 'what is', 'where to buy', 'original', 'premium', 'sasta', 'behtareen', 'asli', 'ki qeemat', 'kaise'];
const KW_POST = ['in pakistan', 'price in pakistan', 'online in pakistan', 'near me', 'for men', 'for women', 'for kids', 'under 1000', 'under 2000', 'under 5000', 'with cash on delivery', 'online shopping', 'review', 'vs', 'guide', 'tips', 'in lahore', 'in karachi', 'in islamabad', 'in kasur', 'urdu', 'ki qeemat', 'kahan se kharide', 'kaise kare', 'ka tarika', 'free download', '2026', 'today', 'wholesale', 'delivery', 'offer', 'sale', 'discount'];
export function keywordIdeas(seed, limit = 300) {
  const s = String(seed || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60);
  if (s.length < 2) return [];
  const out = new Set([s]);
  for (const p of KW_PRE) out.add(`${p} ${s}`);
  for (const q of KW_POST) out.add(`${s} ${q}`);
  for (const p of KW_PRE.slice(0, 8)) for (const q of ['in pakistan', 'online', 'price in pakistan', 'near me', 'under 2000']) out.add(`${p} ${s} ${q}`);
  for (let c = 97; c <= 122; c++) out.add(`${s} ${String.fromCharCode(c)}`);
  return [...out].slice(0, limit);
}
export const metaLen = (t, d) => ({ title: String(t || '').length, desc: String(d || '').length, titleOk: String(t || '').length >= 30 && String(t || '').length <= 60, descOk: String(d || '').length >= 110 && String(d || '').length <= 160 });
export function waLink(phone, msg) {
  const n = String(phone || '').replace(/\D/g, '').replace(/^00/, '').replace(/^0(?=3\d{9}$)/, '92');
  if (n.length < 8) return '';
  return `https://wa.me/${n}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
}

// ---- v26 market / seller tools ----
// Cash-on-delivery profit with returns. A returned parcel costs the delivery both ways and the packing, and earns nothing.
export function codProfit({ price, cost, pack = 0, ship = 0, returnShip = 0, ad = 0, returnRate = 0, orders = 100 }) {
  const P = num(price), C = num(cost), K = num(pack), S = num(ship), R = num(returnShip), A = num(ad), N = Math.max(1, num(orders) || 100);
  const r = Math.min(100, Math.max(0, num(returnRate))) / 100;
  const perDelivered = P - C - K - S;       // profit when the parcel is accepted
  const perReturned = -(S + R + K);         // loss when the customer refuses
  const net = N * ((1 - r) * perDelivered + r * perReturned - A);
  // return rate at which the shop earns nothing: (1-r)*d + r*l - A = 0
  const breakEven = perDelivered - perReturned > 0 ? Math.min(1, Math.max(0, (perDelivered - A) / (perDelivered - perReturned))) : 0;
  return { perDelivered, perReturned, net, perOrder: net / N, breakEvenReturnPct: breakEven * 100, delivered: Math.round(N * (1 - r)), returned: Math.round(N * r) };
}
// Which pack is cheaper per unit? items: [{ name, price, qty }] (qty already in the same unit, e.g. grams). Returns rows sorted cheapest first.
export function unitCompare(items) {
  const rows = (items || []).map((x, i) => ({ name: String(x.name || `Pack ${i + 1}`), price: num(x.price), qty: num(x.qty) })).filter((x) => x.price > 0 && x.qty > 0).map((x) => ({ ...x, per: x.price / x.qty }));
  rows.sort((a, b) => a.per - b.per);
  const best = rows[0];
  return rows.map((x) => ({ ...x, moreThanBestPct: best ? ((x.per - best.per) / best.per) * 100 : 0 }));
}
// Khata (credit book): entries { name, amount } where a positive amount = they owe me, negative = I owe them.
export function khataTotals(entries) {
  const m = new Map();
  for (const e of entries || []) { const k = String(e.name || '').trim().toLowerCase(); if (!k) continue; const cur = m.get(k) || { name: String(e.name).trim(), balance: 0 }; cur.balance += num(e.amount); m.set(k, cur); }
  const people = [...m.values()].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  return { people, toReceive: people.filter((p) => p.balance > 0).reduce((s, p) => s + p.balance, 0), toPay: -people.filter((p) => p.balance < 0).reduce((s, p) => s + p.balance, 0) };
}
