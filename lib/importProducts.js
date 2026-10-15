// Product CSV import for Mizanora. NO imports on purpose: the admin page, the converter script and the
// Firestore import script all use this same file, so prices always come out identical.
//
// Two file formats are understood (detected automatically):
//   1) Markaz / Shopify export  (columns Handle, Title, Body (HTML), Variant Price, Image Src ...)  -> price is the SUPPLIER cost,
//      Mizanora adds the profit and the result is the shop price.
//   2) Mizanora format          (columns slug, name, price ...)  -> price is the FINAL shop price, taken as it is.

// ---------------------------------------------------------------------------------------------
// PRICING.  Delivery is a flat fee charged at checkout (NEXT_PUBLIC_SHIPPING_FEE, default 250).
// Shop price = supplier cost + profit.  Profit is Rs 200-300 on normal items, up to Rs 500 on expensive ones.
// Edit the table below, or change the profit per product in the admin preview before importing.
// ---------------------------------------------------------------------------------------------
export const DELIVERY_FEE = 250;
export const PROFIT_MIN = 200;
export const PROFIT_MAX = 500;
// [supplier cost up to (Rs), profit (Rs)]
export const PROFIT_TIERS = [
  [1000, 200],
  [2000, 250],
  [3000, 300],
  [4500, 400],
  [Infinity, 500],
];

export const clampProfit = (n, min = PROFIT_MIN) => Math.min(PROFIT_MAX, Math.max(min, Math.round(Number(n) || 0)));
export function profitFor(cost, tiers = PROFIT_TIERS, min = PROFIT_MIN) {
  const c = Number(cost) || 0;
  const row = tiers.find(([upTo]) => c <= upTo) || tiers[tiers.length - 1];
  return clampProfit(row[1], min);
}
// Round the shop price to a clean number, but never let profit fall below the minimum.
export function shopPrice(cost, profit, min = PROFIT_MIN) {
  const c = Math.round(Number(cost) || 0);
  let p = Math.round((c + clampProfit(profit, min)) / 10) * 10;
  if (p - c < min) p += 10;
  return p;
}
// Worker commission is a % of the shop price. On a Rs 2,500 item with Rs 250 profit a 10% commission would eat ALL the profit,
// so imported products cap the commission at about 35% of the profit (the product's own affRate, which the worker program respects).
export function safeAffRate(price, profit) {
  const p = Number(price) || 0;
  if (p <= 0) return 0;
  return Math.max(1, Math.min(50, Math.floor(((Number(profit) || 0) * 0.35 * 100) / p)));
}

// ---------------------------------------------------------------------------------------------
// CSV reading / writing (quotes, commas and line breaks inside cells are handled)
// ---------------------------------------------------------------------------------------------
export function parseCsv(text) {
  const s = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== '')) rows.push(row);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, n) => [h, (r[n] ?? '').trim()])));
}

const q = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`; // blocks spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
};

export const MZ_COLUMNS = ['slug', 'name', 'price', 'comparePrice', 'category', 'description', 'images', 'videos', 'options', 'specs', 'inStock', 'featured', 'active', 'affOn', 'affRate', 'cost', 'profit', 'supplierSku', 'sourceUrl'];
const SEP = ' || ';

// products = output of buildProducts()  ->  Mizanora-format CSV text
export function productsToCsv(products) {
  const head = MZ_COLUMNS.map((c) => `"${c}"`).join(',');
  const body = products.map((p) => {
    const d = p.doc;
    return [
      p.slug, d.name, d.price, d.comparePrice || 0, (d.categories || []).join(', '), d.description,
      (d.images || []).join(SEP), (d.videos || []).join(SEP),
      (d.options || []).map((o) => `${o.name}: ${o.values.join(', ')}`).join(SEP), (d.specs || []).join(SEP),
      d.inStock ? 'TRUE' : 'FALSE', d.featured ? 'TRUE' : 'FALSE', d.active ? 'TRUE' : 'FALSE', d.affOn ? 'TRUE' : 'FALSE', d.affRate || 0,
      p.cost?.cost ?? '', p.cost?.profit ?? '', p.cost?.supplierSku ?? '', p.cost?.sourceUrl ?? '',
    ].map(q).join(',');
  });
  return `\uFEFF${[head, ...body].join('\r\n')}`;
}

// ---------------------------------------------------------------------------------------------
// Cleaning helpers
// ---------------------------------------------------------------------------------------------
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&rsquo;': "'", '&lsquo;': "'", '&ndash;': '-', '&mdash;': '-' };
const decode = (s) => String(s).replace(/&(?:amp|lt|gt|quot|#39|nbsp|rsquo|lsquo|ndash|mdash);/g, (m) => ENT[m] || m);
const tidy = (s) => decode(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
export const slugOf = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);

// Supplier branding / links must never reach customers.
const BRAND = /markaz|hhc|dropship|delivered across pakistan|view this product|cash on delivery\.?$|factory direct/i;

function cleanTitle(t) {
  return tidy(t).replace(/\s*\|\s*[A-Z]{1,4}\s*$/, '').replace(/\s*\|\s*/g, ' - ').replace(/\s{2,}/g, ' ').trim();
}

// HTML body -> { description, specs, note, productCode }
export function cleanBody(html) {
  const h = String(html || '');
  const paras = [];
  for (const m of h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    if (/<a\s/i.test(m[1]) && /markaz|view this product/i.test(m[1])) continue;
    const t = tidy(m[1]);
    if (t && !BRAND.test(t)) paras.push(t);
  }
  const specs = [], seen = new Set();
  let note = '', productCode = '';
  for (const m of h.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const t = tidy(m[1]);
    const i = t.indexOf(':');
    if (i < 1 || /^(product code)$/i.test(t.slice(0, i))) { if (i > 0) productCode = t.slice(i + 1).trim(); continue; }
    if (/^note$/i.test(t.slice(0, i))) { note = t.slice(i + 1).trim(); continue; }
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    specs.push(t.replace(/\.$/, ''));
  }
  const body = paras.filter((p, n) => paras.indexOf(p) === n);
  if (note) body.push(`Note: ${note}`);
  return { description: body.join('\n\n').slice(0, 4000), specs: specs.slice(0, 24), productCode };
}

// Markaz photos: the export link (www.markaz.app/api/export/image/...?src=...) is Markaz's official download address and works for
// every type (webp, jpg, jpeg). The plain static.markaz.app address only worked for some of them, so the export link is kept as it is.
export function cleanImage(u) {
  return String(u || '').trim();
}
// The other address of the same photo (used as a fallback when one of the two fails to load).
export function altImage(u) {
  try {
    const url = new URL(String(u));
    const src = url.searchParams.get('src');
    return src && /^https?:\/\//i.test(src) ? src : '';
  } catch (_) { return ''; }
}

// Department mapping so products land in the shop's existing home-page categories.
const DEPT = [
  [/watch/i, 'Watches'],
  [/shoe|boot|heel|slipper|sandal|sneaker|footwear|chappal|khussa|slides?\b/i, 'Footwear'],
  [/bag|handbag|clutch|purse|wallet/i, 'Women Fashion'],
  [/unstitched|3 piece|2 piece|kurti|dupatta|abaya|scarf|stitched.*women|women.*stitched/i, 'Women Fashion'],
  [/men'?s? stitched|track ?suit|jacket|hoodie|shirt|trouser|shalwar|kurta|waistcoat/i, 'Men Fashion'],
  [/kid|toy|baby|rc car/i, 'Kids and Toys'],
  [/mobile|phone|charger|earbud|cable|case\b|airpod/i, 'Mobile Accessories'],
  [/electronic|gadget|speaker|headphone|camera|trimmer|shaver/i, 'Electronics'],
  [/binocular|outdoor|tactical|camp|fitness|gym|sport/i, 'Sports and Outdoor'],
  [/home|kitchen|tool|screwdriver|hardware|decor|storage|travel/i, 'Home and Kitchen'],
  [/beauty|skin|perfume|makeup|cream|hair|care/i, 'Beauty and Care'],
  [/grocery|food|dry fruit|spice|honey/i, 'Grocery'],
  [/car |bike|motor|auto/i, 'Automotive'],
];
// "Men", "Men's", "Man" (but not "Women") in the title or tags = menswear, even for unstitched cloth.
const MEN = /(?<![a-z])(?:men|man)(?:['\u2019]s)?(?![a-z])/i;
const NOT_CLOTHES = /watch|shoe|boot|heel|slipper|sandal|bag|wallet|binocular|tool|toy|car\b/i;
export function departmentOf(type, tags, title) {
  if (MEN.test(`${title} ${tags}`) && !NOT_CLOTHES.test(`${type} ${title}`)) return 'Men Fashion';
  // The product Type is the most specific, then the title; tags are broad (e.g. "Home Essentials") so they come last.
  for (const text of [type || '', title || '', tags || '']) {
    for (const [re, name] of DEPT) if (re.test(text)) return name;
  }
  return 'More';
}

// Sizes that the title promises ("Size 6-11", "Size 40-44") become the full list of choices.
function expandRange(title, firstValue) {
  const m = String(title).match(/size\s*(\d{1,2})\s*-\s*(\d{1,2})\b/i);
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]);
  if (!(b > a) || b - a > 12) return null;
  const out = [];
  for (let n = a; n <= b; n++) out.push(String(n));
  return String(firstValue || '') && !out.includes(String(firstValue)) ? null : out;
}

function optionsFrom(name, value, title) {
  const n = String(name || '').trim(), v = String(value || '').trim();
  if (!n || !v) return [];
  if (/size.*colou?r/i.test(n)) {
    const i = v.lastIndexOf('-');
    if (i > 0) return [{ name: 'Size', values: [v.slice(0, i).trim()] }, { name: 'Color', values: [v.slice(i + 1).trim()] }].filter((o) => o.values[0]);
  }
  const range = /size/i.test(n) ? expandRange(title, v) : null;
  return [{ name: /colou?r/i.test(n) ? 'Color' : /size/i.test(n) ? 'Size' : n, values: range || [v] }];
}

// ---------------------------------------------------------------------------------------------
// Build products.  Returns [{ slug, doc, cost, warn[] }]  -  doc is exactly what goes into Firestore "products/{slug}",
// cost goes into the admin-only "productCosts/{slug}" (never public: it holds your supplier price and source link).
// ---------------------------------------------------------------------------------------------
export function detectFormat(rows) {
  const keys = rows[0] ? Object.keys(rows[0]) : [];
  if (keys.includes('Handle') && keys.some((k) => /^Variant Price$/i.test(k))) return 'markaz';
  if (keys.includes('slug') || (keys.includes('name') && keys.includes('price'))) return 'mizanora';
  return 'unknown';
}

const toArr = (v) => String(v || '').split(/\s*\|\|\s*|\n/).map((x) => x.trim()).filter(Boolean);
const bool = (v, d) => (v === undefined || v === '' ? d : /^(true|1|yes|y)$/i.test(String(v).trim()));

export function buildProducts(rows, opts = {}) {
  const fmt = detectFormat(rows);
  const now = opts.now || Date.now();
  const tiers = opts.tiers || PROFIT_TIERS;
  const out = [];
  const used = new Set();
  const uniq = (s) => { let x = s || 'product', n = 2; while (used.has(x)) x = `${s}-${n++}`; used.add(x); return x; };

  if (fmt === 'markaz') {
    const groups = new Map();
    for (const r of rows) {
      if (!r.Handle) continue;
      if (!groups.has(r.Handle)) groups.set(r.Handle, []);
      groups.get(r.Handle).push(r);
    }
    let i = 0;
    for (const [handle, g] of groups) {
      const main = g.find((r) => r.Title) || g[0];
      const warn = [];
      const csvPrice = Number(main['Variant Price']) || 0;
      // If the supplier price already contains delivery, opts.deduct (e.g. 250) is taken off first to get the real product cost.
      const cost = csvPrice - (Number(opts.deduct) || 0);
      const min = opts.minProfit ?? PROFIT_MIN;
      if (!(cost > 0)) continue;
      const title = cleanTitle(main.Title);
      const body = cleanBody(main['Body (HTML)']);
      const profit = opts.profits && opts.profits[handle] != null ? clampProfit(opts.profits[handle], min) : profitFor(cost, tiers, min);
      const price = shopPrice(cost, profit, min);
      const images = [...new Set(g.map((r) => cleanImage(r['Image Src'])).filter(Boolean))].slice(0, 8);
      if (!images.length) warn.push('no photo');
      const slug = uniq(slugOf(handle.replace(/-mkz-(\d+)$/, '-$1')) || slugOf(title));
      const dept = departmentOf(main.Type, main.Tags, title);
      const sourceUrl = ((String(main['Body (HTML)']).match(/href=["']+([^"'\s]+markaz[^"'\s]+)/i) || [])[1] || '').replace(/&amp;/g, '&');
      const aff = safeAffRate(price, profit);
      out.push({
        slug, handle, warn,
        doc: {
          name: title, price, comparePrice: 0, category: dept, categories: [dept],
          description: body.description || title, images, videos: [],
          options: optionsFrom(main['Option1 Name'], main['Option1 Value'], title), sizes: [], specs: body.specs,
          inStock: true, featured: i < (opts.featuredCount ?? 0), active: opts.publish !== false,
          affOn: opts.affOn !== false, affRate: aff,
          createdAt: now - i * 1000, updatedAt: now,
        },
        cost: { cost, csvPrice, profit, deliveryFee: DELIVERY_FEE, supplier: 'Markaz', supplierSku: main['Variant SKU'] || '', productCode: body.productCode || '', sourceUrl, importedAt: now },
      });
      i++;
    }
  } else if (fmt === 'mizanora') {
    let i = 0;
    for (const r of rows) {
      const name = tidy(r.name);
      const price = Number(r.price);
      if (!name || !(price > 0)) continue;
      const slug = uniq(slugOf(r.slug || name));
      const cats = String(r.category || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
      const options = toArr(r.options).map((line) => { const k = line.indexOf(':'); return k > 0 ? { name: line.slice(0, k).trim(), values: line.slice(k + 1).split(',').map((x) => x.trim()).filter(Boolean) } : null; }).filter((o) => o && o.values.length);
      const cost = Number(r.cost) || 0;
      const profit = cost ? price - cost : Number(r.profit) || 0;
      out.push({
        slug, handle: slug, warn: cost && profit > PROFIT_MAX ? [`profit Rs ${profit} is above Rs ${PROFIT_MAX}`] : [],
        doc: {
          name, price, comparePrice: Number(r.comparePrice) || 0, category: cats[0] || '', categories: cats,
          description: String(r.description || '').trim(), images: toArr(r.images).map(cleanImage), videos: toArr(r.videos), options, sizes: [], specs: toArr(r.specs),
          inStock: bool(r.inStock, true), featured: bool(r.featured, false), active: bool(r.active, true), affOn: bool(r.affOn, true),
          affRate: Math.min(50, Math.max(0, Number(r.affRate) || 0)), createdAt: now - i * 1000, updatedAt: now,
        },
        cost: cost ? { cost, profit, deliveryFee: DELIVERY_FEE, supplier: 'Markaz', supplierSku: r.supplierSku || '', sourceUrl: r.sourceUrl || '', importedAt: now } : null,
      });
      i++;
    }
  }
  return { format: fmt, products: out };
}
