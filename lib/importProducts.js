// Product CSV reading and pricing for Mizanora. The admin page, the converter script and the
// command-line loader all use this same file, so prices always come out identical.
//
// Two file formats are understood (detected automatically):
//   1) Markaz / Shopify export  (Handle, Title, Body (HTML), Variant Price, Option1 Name/Value ... Image Src)
//      -> price is the SUPPLIER cost, Mizanora adds the profit and the result is the shop price.
//   2) Mizanora format          (slug, name, price ...)  -> price is the FINAL shop price, taken as it is.
//
// v16 fixes (CSV extraction):
//   - EVERY variant row of a product is read (old code used only the first row, so most sizes and colours were lost).
//   - Option1 / Option2 / Option3 are all read, with unique values in the order they appear in the sheet.
//   - Prices like "1,250" or "Rs 1,250.00" are understood (before they became NaN and the product was silently skipped).
//   - Column names are matched without caring about capitals, spaces, brackets or underscores.
//   - Stock comes from "Variant Inventory Qty" when the sheet has it.
//   - Descriptions: every HTML entity is decoded (&#8217; &#x27; ...), and plain-text / <br> bodies are read too.
//   - A quote only starts a quoted cell at the beginning of a cell (a stray " inside a word no longer swallows the row).

import { splitMedia } from './media.js';

// ---------------------------------------------------------------------------------------------
// PRICING.  Delivery is a flat fee charged at checkout (NEXT_PUBLIC_SHIPPING_FEE, default 250).
// Shop price = supplier cost + profit.
//   supplier cost up to Rs 100  ->  profit Rs 2 to Rs 30 (grows with the cost)
//   supplier cost up to Rs 500  ->  profit Rs 100
//   above that                  ->  Rs 200 to Rs 500 (bigger items, bigger profit)
// Edit the table below, or change the profit per product in the admin preview before importing.
// ---------------------------------------------------------------------------------------------
export const DELIVERY_FEE = 250;
export const PROFIT_MIN = 2;
export const PROFIT_MAX = 500;
// [supplier cost up to (Rs), profit (Rs)]
export const PROFIT_TIERS = [
  [20, 2],
  [40, 8],
  [60, 14],
  [80, 21],
  [100, 30],
  [500, 100],
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
// Round UP to a clean price (Rs 1 steps for cheap items so a Rs 2 to 30 profit stays exact, Rs 5 up to Rs 500 cost, Rs 10 above).
// Rounding only goes up, so the profit is never below the chosen amount.
export function shopPrice(cost, profit, min = PROFIT_MIN) {
  const c = Math.round(Number(cost) || 0);
  const pr = clampProfit(profit, min);
  const step = c <= 100 ? 1 : c <= 500 ? 5 : 10;
  return Math.ceil((c + pr) / step) * step;
}
// Worker commission is a % of the shop price. On a Rs 2,500 item with Rs 250 profit a 10% commission would eat ALL the profit,
// so imported products cap the commission at about 35% of the profit (the product's own affRate, which the worker program respects).
export function safeAffRate(price, profit) {
  const p = Number(price) || 0;
  if (p <= 0) return 0;
  return Math.max(1, Math.min(50, Math.floor(((Number(profit) || 0) * 0.35 * 100) / p)));
}

// Numbers as people type them: "1,250", "Rs 1,250.00", " 95 " all become a real number (0 if there is none).
export function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v ?? '').replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// Column key that ignores capitals, spaces, brackets and underscores: "Variant Price", "variant_price" and "VARIANT PRICE (RS)" all match.
const canon = (k) => String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const canonRow = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [canon(k), v]));

// ---------------------------------------------------------------------------------------------
// CSV reading / writing (quotes, commas and line breaks inside cells are handled)
// ---------------------------------------------------------------------------------------------
export function parseCsv(text) {
  const s = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cell = '', q = false, quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
    } else if (ch === '"' && cell === '' && !quoted) { q = true; quoted = true; }
    else if (ch === ',') { row.push(cell); cell = ''; quoted = false; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = ''; quoted = false;
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
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
      (d.options || []).map((o) => `${o.name}: ${o.values.join(', ')}`).join(SEP), (d.specs || []).map((s) => s).join(SEP),
      d.inStock ? 'TRUE' : 'FALSE', d.featured ? 'TRUE' : 'FALSE', d.active ? 'TRUE' : 'FALSE', d.affOn ? 'TRUE' : 'FALSE', d.affRate || 0,
      p.cost?.cost ?? '', p.cost?.profit ?? '', p.cost?.supplierSku ?? '', p.cost?.sourceUrl ?? '',
    ].map(q).join(',');
  });
  return `\uFEFF${[head, ...body].join('\r\n')}`;
}

// ---------------------------------------------------------------------------------------------
// Cleaning helpers
// ---------------------------------------------------------------------------------------------
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: '-', mdash: '-', hellip: '...', copy: '(c)', reg: '(r)', trade: '(tm)', times: 'x' };
// Every HTML entity: named ones, &#8217; decimal and &#x27; hex.
const decode = (s) => String(s)
  .replace(/&#x([0-9a-f]+);/gi, (m, h) => { const c = parseInt(h, 16); return c ? String.fromCodePoint(c) : ' '; })
  .replace(/&#(\d+);/g, (m, d) => { const c = Number(d); return c ? String.fromCodePoint(c) : ' '; })
  .replace(/&([a-z]+);/gi, (m, n) => (NAMED[n.toLowerCase()] !== undefined ? NAMED[n.toLowerCase()] : m));
const line1 = (s) => tidy(s).replace(/\s+/g, ' ').trim();
const tidy = (s) => decode(String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ')).replace(/[ \t\u00a0]+/g, ' ').replace(/ *\n */g, '\n').trim();
export const slugOf = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);

// Supplier branding / links must never reach customers.
const BRAND = /markaz|hhc|dropship|delivered across pakistan|view this product|cash on delivery\.?$|factory direct/i;

function cleanTitle(t) {
  return line1(t).replace(/\s*\|\s*[A-Z]{1,4}\s*$/, '').replace(/\s*\|\s*/g, ' - ').replace(/\s{2,}/g, ' ').trim();
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
  // No <p> tags (plain text or <br> separated)? Use the lines of the body instead.
  if (!paras.length && h && !/<p[\s>]/i.test(h)) {
    for (const line of tidy(h).split('\n')) { const t = line.trim(); if (t && !BRAND.test(t)) paras.push(t); }
  }
  const specs = [], seen = new Set();
  let note = '', productCode = '';
  for (const m of h.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const t = tidy(m[1]).replace(/\s+/g, ' ');
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

// Sizes that the title promises ("Size 6-11", "Size 40-44") - only used when the sheet has no size list of its own.
function expandRange(title) {
  const m = String(title).match(/size\s*(\d{1,2})\s*-\s*(\d{1,2})\b/i);
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]);
  if (!(b > a) || b - a > 12) return null;
  const out = [];
  for (let n = a; n <= b; n++) out.push(String(n));
  return out;
}

// Option names as the shop shows them.
export function optionName(raw) {
  const n = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!n || /^(title|default title)$/i.test(n)) return '';
  if (/size/i.test(n)) return 'Size';            // "Size / Color" is a size option (split later)
  if (/colou?r|shade|rang/i.test(n)) return 'Color';
  return n.slice(0, 30);
}

// Unique values in the order they appear, empty and "Default Title" values dropped.
const uniqueVals = (vals) => {
  const out = [];
  for (const v of vals) {
    const s = String(v || '').replace(/\s+/g, ' ').trim();
    if (!s || /^default title$/i.test(s) || out.includes(s)) continue;
    out.push(s);
  }
  // Pure numbers (sizes like 38, 39, 40) are shown smallest first.
  if (out.length > 1 && out.every((x) => /^\d+(\.\d+)?$/.test(x))) out.sort((a, b) => Number(a) - Number(b));
  return out.slice(0, 60);
};

// Reads every variant row of one product and returns the shop options ([{ name, values }]).
export function optionsFromVariants(group, title) {
  const slots = [1, 2, 3].map((k) => {
    const name = group.map((r) => optionName(r[`option${k}name`])).find(Boolean) || '';
    const values = uniqueVals(group.map((r) => r[`option${k}value`]));
    return { name, values };
  }).filter((o) => o.name && o.values.length);

  // "Size - Red" style: one option holding both size and colour -> split into Size and Color.
  const combined = slots.find((o) => o.name === 'Size' && o.values.some((v) => v.includes(' - ')));
  if (combined) {
    const sizes = [], colors = [];
    for (const v of combined.values) {
      const i = v.lastIndexOf(' - ');
      sizes.push(i > 0 ? v.slice(0, i).trim() : v);
      if (i > 0) colors.push(v.slice(i + 3).trim());
    }
    const rest = slots.filter((o) => o !== combined);
    const out = [{ name: 'Size', values: uniqueVals(sizes) }];
    if (colors.length) out.push({ name: 'Color', values: uniqueVals(colors) });
    return [...out, ...rest].filter((o) => o.values.length);
  }

  if (!slots.length) {
    const range = expandRange(title);
    return range ? [{ name: 'Size', values: range }] : [];
  }
  return slots;
}

// ---------------------------------------------------------------------------------------------
// Build products.  Returns { format, products: [{ slug, doc, cost, warn[] }] }  -  doc is exactly what goes into Firestore "products/{slug}",
// cost goes into the admin-only "productCosts/{slug}" (never public: it holds your supplier price and source link).
// ---------------------------------------------------------------------------------------------
export function detectFormat(rows) {
  const keys = rows[0] ? Object.keys(canonRow(rows[0])) : [];
  if (keys.includes('handle') && keys.includes('variantprice')) return 'markaz';
  if (keys.includes('slug') || (keys.includes('name') && keys.includes('price'))) return 'mizanora';
  return 'unknown';
}

const toArr = (v) => String(v || '').split(/\s*\|\|\s*|\n/).map((x) => x.trim()).filter(Boolean);
const bool = (v, d) => (v === undefined || v === '' ? d : /^(true|1|yes|y)$/i.test(String(v).trim()));

export function buildProducts(rawRows, opts = {}) {
  const rows = (rawRows || []).map(canonRow);
  const fmt = detectFormat(rows);
  const now = opts.now || Date.now();
  const tiers = opts.tiers || PROFIT_TIERS;
  const out = [];
  const used = new Set();
  const uniq = (s) => { let x = s || 'product', n = 2; while (used.has(x)) x = `${s}-${n++}`; used.add(x); return x; };

  if (fmt === 'markaz') {
    // Variant rows of one product share the Handle. Some exports leave it empty on the extra rows: those belong to the product above.
    const groups = new Map();
    let last = '';
    for (const r of rows) {
      if (r.handle) last = String(r.handle);
      const h = String(r.handle || last);
      if (!h) continue;
      if (!groups.has(h)) groups.set(h, []);
      groups.get(h).push(r);
    }
    let i = 0;
    for (const [handle, g] of groups) {
      const main = g.find((r) => r.title) || g[0];
      const warn = [];
      // Every variant has its own price in some exports. The shop shows ONE price, so the HIGHEST supplier price is used
      // (safe for profit: a cheaper size never makes a loss), and the difference is reported in the preview.
      const prices = g.map((r) => num(r.variantprice)).filter((p) => p > 0);
      if (!prices.length) continue;
      const csvPrice = Math.max(...prices);
      if (prices.length > 1 && Math.min(...prices) < csvPrice) warn.push(`variant prices Rs ${Math.min(...prices)}-${csvPrice}, highest used`);
      // If the supplier price already contains delivery, opts.deduct (e.g. 250) is taken off first to get the real product cost.
      const cost = csvPrice - (Number(opts.deduct) || 0);
      const min = opts.minProfit ?? PROFIT_MIN;
      if (!(cost > 0)) continue;
      const title = cleanTitle(main.title);
      const body = cleanBody(main.bodyhtml);
      const profit = opts.profits && opts.profits[handle] != null ? clampProfit(opts.profits[handle], min) : profitFor(cost, tiers, min);
      const price = shopPrice(cost, profit, min);
      // A supplier CSV often puts a Facebook / Instagram / TikTok / YouTube / .mp4 link in the "Image Src" column.
      // Those are split out here: they become videos (a YouTube link also gives us a real thumbnail photo).
      const imgCells = [...new Set(g.flatMap((r) => [cleanImage(r.imagesrc), cleanImage(r.variantimage)]).filter(Boolean))];
      const vidCells = [...new Set(g.flatMap((r) => [cleanImage(r.videosrc), cleanImage(r.videourl), cleanImage(r.video)]).filter(Boolean))];
      const media = splitMedia(imgCells, vidCells);
      const images = media.images.slice(0, 8);
      const videos = media.videos.slice(0, 6);
      if (!images.length && !videos.length) warn.push('no photo');
      else if (!images.length) warn.push('video only');
      // Stock: if the sheet has inventory numbers, the product is in stock when any variant has some.
      const qty = g.map((r) => r.variantinventoryqty).filter((v) => v !== undefined && String(v).trim() !== '').map(num);
      const inStock = qty.length ? qty.some((n) => n > 0) : true;
      if (qty.length && !inStock) warn.push('all variants out of stock in the sheet');
      const options = optionsFromVariants(g, title);
      if (options.some((o) => o.name === 'Size' && o.values.length === 1)) warn.push('only one size in the sheet');
      if (!options.length) warn.push('no size/colour options');
      const slug = uniq(slugOf(handle.replace(/-mkz-(\d+)$/, '-$1')) || slugOf(title));
      const dept = departmentOf(main.type, main.tags, title);
      const sourceUrl = ((String(main.bodyhtml || '').match(/href=["']+([^"'\s]+markaz[^"'\s]+)/i) || [])[1] || '').replace(/&amp;/g, '&');
      const aff = safeAffRate(price, profit);
      out.push({
        slug, handle, warn,
        doc: {
          name: title, price, comparePrice: 0, category: dept, categories: [dept],
          description: body.description || title, images, videos,
          options, sizes: [], specs: body.specs,
          inStock, featured: i < (opts.featuredCount ?? 0), active: opts.publish !== false,
          affOn: opts.affOn !== false, affRate: aff, dealRoom: Math.max(0, profit - 50),
          createdAt: now - i * 1000, updatedAt: now,
        },
        cost: { cost, csvPrice, profit, deliveryFee: DELIVERY_FEE, supplier: 'Markaz', supplierSku: main.variantsku || '', productCode: body.productCode || '', sourceUrl, importedAt: now, variants: g.length },
      });
      i++;
    }
  } else if (fmt === 'mizanora') {
    let i = 0;
    for (const r of rows) {
      const name = line1(r.name);
      const price = num(r.price);
      if (!name || !(price > 0)) continue;
      const slug = uniq(slugOf(r.slug || name));
      const cats = String(r.category || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
      const options = toArr(r.options).map((line) => { const k = line.indexOf(':'); return k > 0 ? { name: line.slice(0, k).trim(), values: line.slice(k + 1).split(',').map((x) => x.trim()).filter(Boolean) } : null; }).filter((o) => o && o.values.length);
      const cost = num(r.cost);
      const profit = cost ? price - cost : num(r.profit);
      const warn = cost && profit > PROFIT_MAX ? [`profit Rs ${profit} is above Rs ${PROFIT_MAX}`] : [];
      out.push({
        slug, handle: slug, warn,
        doc: {
          name, price, comparePrice: num(r.compareprice), category: cats[0] || '', categories: cats,
          description: String(r.description || '').trim(),
          ...(() => { const m = splitMedia(toArr(r.images).map(cleanImage), toArr(r.videos)); return { images: m.images, videos: m.videos }; })(),
          options, sizes: [], specs: toArr(r.specs),
          inStock: bool(r.instock, true), featured: bool(r.featured, false), active: bool(r.active, true), affOn: bool(r.affon, true),
          affRate: Math.min(50, Math.max(0, num(r.affrate))), createdAt: now - i * 1000, updatedAt: now,
          ...(cost ? { dealRoom: Math.max(0, profit - 50) } : {}),
        },
        cost: cost ? { cost, profit, deliveryFee: DELIVERY_FEE, supplier: 'Markaz', supplierSku: r.suppliersku || '', sourceUrl: r.sourceurl || '', importedAt: now } : null,
      });
      i++;
    }
  }
  return { format: fmt, products: out };
}
