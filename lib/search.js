// "AI-like" shop search that runs in the browser (no key needed).
// It understands English, Roman Urdu and Hindi words, colours, price limits and "cheap / premium", and forgives spelling mistakes.
//   "laal suit 2000 se kam"  ->  red + suit, under Rs. 2000
//   "black joota under 5k"   ->  black + shoes, under Rs. 5000
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Urdu script words -> the Roman Urdu words the search already understands (so typing or speaking in Urdu works).
const URDU = {
  'جوتا': 'joota', 'جوتے': 'joota', 'جوتی': 'jooti', 'چپل': 'chappal', 'گھڑی': 'ghari', 'کپڑے': 'kapray', 'کپڑا': 'kapra', 'سوٹ': 'suit', 'لان': 'lawn',
  'دوپٹہ': 'dupatta', 'دوپٹے': 'dupatta', 'شال': 'shawl', 'چادر': 'chadar', 'عبایا': 'abaya', 'شلوار': 'shalwar', 'قمیض': 'kameez', 'کرتا': 'kurta',
  'موبائل': 'mobile', 'فون': 'phone', 'کور': 'cover', 'چارجر': 'charger', 'ہینڈ': 'handsfree', 'فری': '', 'ایئرپوڈز': 'airpods', 'بیگ': 'bag', 'پرس': 'purse', 'والٹ': 'wallet',
  'پرفیوم': 'perfume', 'عطر': 'attar', 'کھلونے': 'khilone', 'کھلونا': 'khilona', 'بچے': 'bachay', 'بچوں': 'bachon', 'برتن': 'bartan', 'شہد': 'shehad', 'تیل': 'tail',
  'لیڈیز': 'ladies', 'خواتین': 'women', 'مردانہ': 'mardana', 'لال': 'laal', 'سرخ': 'laal', 'کالا': 'kala', 'کالے': 'kala', 'نیلا': 'neela', 'ہرا': 'hara', 'سبز': 'hara',
  'پیلا': 'peela', 'سفید': 'safed', 'گلابی': 'gulabi', 'جامنی': 'jamni', 'نارنجی': 'narangi', 'بھورا': 'bhura', 'سستا': 'sasta', 'سستی': 'sasta', 'سستے': 'sasta',
  'مہنگا': 'mehnga', 'نیا': 'naya', 'نئے': 'naya', 'کم': 'kam', 'سے': 'se', 'تک': 'tak', 'ہزار': 'hazar', 'اور': 'aur', 'میں': 'mein', 'چاہیے': 'chahiye', 'دکھاؤ': 'dikhao',
};
// Urdu / Arabic-Indic digits -> 0-9
const digits = (s) => String(s || '').replace(/[\u06F0-\u06F9]/g, (c) => c.charCodeAt(0) - 0x06F0).replace(/[\u0660-\u0669]/g, (c) => c.charCodeAt(0) - 0x0660);
const romanize = (t) => t.split(' ').map((w) => (w in URDU ? URDU[w] : w)).join(' ').replace(/\s+/g, ' ').trim()
  .replace(/(\d)\s+(k|hazar|hazaar)\b/g, '$1$2'); // "2 hazar" -> "2hazar"

const SYN = {
  joota: ['shoes', 'footwear', 'boots', 'sneakers'], juta: ['shoes', 'footwear'], jootay: ['shoes', 'footwear'], jooti: ['shoes', 'sandal', 'footwear'], khussa: ['shoes', 'footwear'],
  chappal: ['sandal', 'slippers', 'footwear'], shoe: ['shoes', 'footwear'], shoes: ['footwear', 'sneakers', 'boots'], boot: ['boots', 'footwear'], sneaker: ['sneakers', 'shoes'],
  kapray: ['clothes', 'dress', 'suit', 'fashion'], kapre: ['clothes', 'dress', 'suit', 'fashion'], kapra: ['clothes', 'fabric', 'suit'], libas: ['clothes', 'dress', 'suit'], poshak: ['clothes', 'dress'],
  joda: ['suit'], jora: ['suit'], suit: ['suit', 'lawn', 'katan', 'dress'], suits: ['suit'], lawn: ['lawn', 'suit'], dress: ['dress', 'suit', 'kurti', 'frock'],
  dupatta: ['dupatta', 'chunri', 'scarf'], chadar: ['dupatta', 'shawl'], chunri: ['dupatta'], shawl: ['shawl', 'chadar'], abaya: ['abaya', 'burqa'],
  shalwar: ['shalwar', 'kameez', 'suit'], kameez: ['kameez', 'shalwar', 'kurta'], kurta: ['kurta', 'kameez'],
  ghari: ['watch', 'smartwatch'], gari: ['watch'], watch: ['watch', 'smartwatch', 'ghari'],
  mobile: ['mobile', 'phone', 'smartphone'], fone: ['phone', 'mobile'], phone: ['phone', 'mobile'], cover: ['case', 'cover'], case: ['case', 'cover'], charger: ['charger', 'adapter', 'cable'], chargar: ['charger'],
  handsfree: ['earbuds', 'headphone', 'earphones'], earbuds: ['earbuds', 'airpods', 'headphone'], airpods: ['earbuds', 'headphone'], headphone: ['headphone', 'earbuds'],
  bag: ['bag', 'purse', 'handbag', 'backpack'], bags: ['bag', 'purse'], purse: ['bag', 'handbag', 'wallet'], thaila: ['bag'], wallet: ['wallet', 'purse'],
  perfume: ['perfume', 'attar', 'fragrance', 'spray'], itar: ['perfume', 'attar'], attar: ['perfume', 'attar'], khushboo: ['perfume'],
  khilona: ['toy', 'toys'], khilone: ['toy', 'toys'], toy: ['toy', 'toys'], bacha: ['kids', 'baby', 'child'], bachay: ['kids', 'baby', 'child'], bachon: ['kids', 'baby', 'child'], bachey: ['kids'], kids: ['kids', 'baby', 'child'],
  bartan: ['kitchen', 'utensil', 'cookware'], kitchen: ['kitchen', 'cookware'], ghar: ['home', 'decor'], gharelu: ['home', 'kitchen'],
  shehad: ['honey'], shahad: ['honey'], honey: ['honey', 'shehad'], tail: ['oil'], oil: ['oil', 'tail'],
  ladies: ['women', 'ladies'], women: ['women', 'ladies', 'girls'], aurat: ['women', 'ladies'], mardana: ['men', 'mens'], men: ['men', 'mens', 'gents'], gents: ['men', 'mens'], larkiyon: ['women', 'girls'], larkon: ['men', 'boys'],
};
const COLORS = {
  red: 'red', laal: 'red', lal: 'red', black: 'black', kala: 'black', kaala: 'black', blue: 'blue', neela: 'blue', nila: 'blue', green: 'green', hara: 'green', yellow: 'yellow', peela: 'yellow', pila: 'yellow',
  white: 'white', safed: 'white', safaid: 'white', pink: 'pink', gulabi: 'pink', purple: 'purple', jamni: 'purple', baingni: 'purple', orange: 'orange', narangi: 'orange', brown: 'brown', bhura: 'brown',
  grey: 'grey', gray: 'grey', maroon: 'maroon', navy: 'navy', golden: 'golden', silver: 'silver', beige: 'beige', skin: 'skin',
};
const STOP = new Set(('for with in the a an of and or me mein main ka ki ke ko se chahiye chahye chahiey dikhao dikha show find best good please any wala wali wale hai hain do dein mujhe i want need looking buy get under below less than upto up to max above over more min rs pkr rupees rupay rupaye tak kam zyada ziada upar sasta saste cheap budget mehnga mahenga premium luxury expensive naya new latest lowest highest price items item products product').split(' '));

function money(raw) {
  const m = String(raw).replace(/,/g, '').match(/^(\d+(?:\.\d+)?)(k|hazar|hazaar)?$/);
  if (!m) return null;
  return Math.round(Number(m[1]) * (m[2] ? 1000 : 1));
}

export function parseQuery(q) {
  const text = romanize(norm(digits(q)));
  let min = 0; let max = 0; let sort = '';
  let rest = ` ${text} `;
  const take = (re, fn) => { rest = rest.replace(re, (...a) => { fn(a); return ' '; }); };
  const NUM = '(?:rs\\.? ?|pkr ?)?(\\d[\\d,]*(?:\\.\\d+)?(?:k|hazar|hazaar)?)';
  take(new RegExp(` between ${NUM} (?:and|to|aur) ${NUM} `, 'g'), (a) => { min = money(a[1]) || 0; max = money(a[2]) || 0; });
  take(new RegExp(` ${NUM} (?:se|to|-) ${NUM} (?:tak|ke beech|ke darmiyan|rs|pkr)? `, 'g'), (a) => { const x = money(a[1]); const y = money(a[2]); if (x && y && y > x) { min = x; max = y; } });
  take(new RegExp(` (?:under|below|less than|upto|up to|max|maximum|within|budget) ${NUM} `, 'g'), (a) => { max = money(a[1]) || 0; });
  take(new RegExp(` ${NUM} (?:se kam|se neeche|tak|se niche|ke andar|or less|below) `, 'g'), (a) => { max = money(a[1]) || 0; });
  take(new RegExp(` (?:above|over|more than|min|minimum|from) ${NUM} `, 'g'), (a) => { min = money(a[1]) || 0; });
  take(new RegExp(` ${NUM} (?:se zyada|se ziada|se upar|or more|plus|\\+) `, 'g'), (a) => { min = money(a[1]) || 0; });
  const toks = rest.split(' ').filter(Boolean);
  const words = []; const colors = [];
  for (const t of toks) {
    if (/^(sasta|saste|cheap|budget|lowest)$/.test(t)) sort = 'low';
    else if (/^(mehnga|mahenga|premium|luxury|expensive|highest)$/.test(t)) sort = 'high';
    else if (/^(naya|new|latest)$/.test(t)) sort = sort || 'new';
    if (COLORS[t]) { colors.push(COLORS[t]); continue; }
    if (STOP.has(t) || /^\d+$/.test(t)) continue;
    words.push(t);
  }
  return { words, colors: [...new Set(colors)], min, max, sort };
}

function edit(a, b) {
  const lim = a.length > 6 ? 2 : 1;
  if (Math.abs(a.length - b.length) > lim) return false;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length] <= lim;
}

function parts(p) {
  const opt = (p.options || []).flatMap((o) => o.values || []);
  const spec = (p.specs || []).map((x) => (typeof x === 'string' ? x : x.v));
  return { name: norm(p.name), cat: norm((p.categories && p.categories.length ? p.categories : [p.category]).join(' ')), opt: norm(opt.join(' ')), spec: norm(spec.join(' ')), desc: norm(p.description), colors: norm((p.options || []).filter((o) => /colou?r|shade|rang/i.test(o.name)).flatMap((o) => o.values).join(' ')) };
}

function wordScore(w, h) {
  const alts = [w, ...(SYN[w] || [])];
  let best = 0;
  alts.forEach((alt, n) => {
    const k = n === 0 ? 1 : 0.8;
    const hit = (txt, pts) => {
      if (!txt) return;
      if (txt.startsWith(alt) || txt.split(' ').some((x) => x.startsWith(alt))) best = Math.max(best, pts * k);
      else if (txt.includes(alt)) best = Math.max(best, pts * k * 0.7);
    };
    hit(h.name, 6); hit(h.cat, 5); hit(h.opt, 3); hit(h.spec, 2); hit(h.desc, 1);
    if (!best && alt.length >= 4) {
      const pool = `${h.name} ${h.cat}`.split(' ');
      if (pool.some((x) => edit(alt, x))) best = Math.max(best, 1.5 * k);
    }
  });
  return best;
}

export function smartSearch(list, q, { limit = 60, intent: override } = {}) {
  const intent = { ...parseQuery(q), ...(override || {}) };
  const { words, colors, min, max } = intent;
  const rows = [];
  for (const p of list) {
    if (min && p.price < min) continue;
    if (max && p.price > max) continue;
    const h = parts(p);
    let score = 0; let all = true; let any = false;
    for (const w of words) { const s = wordScore(w, h); if (s) { any = true; score += s; } else all = false; }
    for (const c of colors) { if (h.colors.includes(c) || h.name.includes(c)) score += 3; }
    if (words.length && !any) continue;
    rows.push({ p, score, all });
  }
  if (!words.length && colors.length) { // only a colour typed: show items that really have that colour (or everything if none do)
    const withColor = rows.filter((r) => r.score > 0);
    if (withColor.length) rows.splice(0, rows.length, ...withColor);
  }
  let strict = rows.filter((r) => r.all);
  if (!strict.length) strict = rows; // nothing matched every word: show the closest matches instead of nothing
  strict.sort((a, b) => b.score - a.score);
  let out = strict.map((r) => r.p);
  if (intent.sort === 'low') out = [...out].sort((a, b) => a.price - b.price);
  if (intent.sort === 'high') out = [...out].sort((a, b) => b.price - a.price);
  return { results: out.slice(0, limit), intent };
}

export const searchProducts = (list, q, limit = 6) => smartSearch(list, q, { limit }).results;

export function describeIntent(i) {
  const out = [];
  if (i.colors && i.colors.length) out.push(i.colors.join(' / '));
  if (i.min && i.max) out.push(`Rs. ${i.min} to ${i.max}`);
  else if (i.max) out.push(`under Rs. ${i.max}`);
  else if (i.min) out.push(`above Rs. ${i.min}`);
  if (i.sort === 'low') out.push('lowest price first');
  if (i.sort === 'high') out.push('highest price first');
  return out;
}
