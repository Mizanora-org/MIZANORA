// Product options (Color, Size, Storage, Shade ...) and specs (Material, Brand, Warranty ...).
// Stored on the product as: options: [{ name, values: [] }]  and  specs: ["Material: Katan silk", ...].
// Old products that only have "sizes" keep working: they become one option called "Size".
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const list = (v) => (Array.isArray(v) ? v : String(v || '').split(/[\n,]/)).map(clean).filter(Boolean);

export function optionsOf(x) {
  if (Array.isArray(x.options) && x.options.length) {
    return x.options.map((o) => ({ name: clean(o && o.name).slice(0, 30), values: list(o && o.values).slice(0, 60) })).filter((o) => o.name && o.values.length).slice(0, 6);
  }
  const sizes = list(x.sizes);
  return sizes.length ? [{ name: 'Size', values: sizes }] : [];
}

export const specsOf = (x) => (Array.isArray(x.specs) ? x.specs : []).map((s) => {
  const i = String(s).indexOf(':');
  return i > 0 ? { k: clean(String(s).slice(0, i)), v: clean(String(s).slice(i + 1)) } : null;
}).filter((s) => s && s.k && s.v);

// Admin text format. One option per line:   Color: Red, Blue, Black
export const optionsToText = (opts) => (opts || []).map((o) => `${o.name}: ${o.values.join(', ')}`).join('\n');
export function textToOptions(text) {
  return String(text || '').split('\n').map((line) => {
    const i = line.indexOf(':');
    if (i < 1) return null;
    return { name: clean(line.slice(0, i)).slice(0, 30), values: list(line.slice(i + 1)) };
  }).filter((o) => o && o.name && o.values.length);
}
export const textToSpecs = (text) => String(text || '').split('\n').map(clean).filter((l) => l.indexOf(':') > 0);

// The chosen values become one label, in option order: "Baby Pink / M". That label is what the cart and orders store.
export const variantLabel = (opts, sel) => opts.map((o) => sel[o.name]).join(' / ');
export const validVariant = (opts, label) => {
  if (!opts.length) return true;
  const parts = String(label || '').split(' / ');
  return parts.length === opts.length && opts.every((o, n) => o.values.includes(parts[n]));
};

export const isColorOption = (name) => /colou?r|shade|rang/i.test(name);
const HEX = {
  black: '#111', white: '#fff', red: '#d62828', maroon: '#6d1a24', pink: '#f5a3bf', 'baby pink': '#f9c6d6', blue: '#1f5fd1', 'navy blue': '#14295a', navy: '#14295a',
  'royal blue': '#2349c7', 'sky blue': '#7ec8f2', green: '#1f8a4c', 'olive green': '#6b7a2a', 'bottle green': '#0b4d33', yellow: '#f6c928', orange: '#f28c1e', purple: '#7a35c5',
  brown: '#7a4a2a', grey: '#8d949b', gray: '#8d949b', skin: '#e8c4a0', beige: '#d9c7a3', cream: '#f3ead2', golden: '#d4a72c', gold: '#d4a72c', silver: '#c4c8cc', camel: '#b88a4a', khaki: '#b3a46b', mustard: '#d9a521', peach: '#f7b999', mehndi: '#8a8f2f', firozi: '#2bb3b1', turquoise: '#2bb3b1',
};
export const colorHex = (v) => HEX[clean(v).toLowerCase()] || '';

// Suggestions shown in the admin when a category is chosen. Tap to add; edit freely afterwards.
const T = [
  [/shoe|boot|foot|sandal|sneaker|chappal|joot/i, { options: ['Size: 38, 39, 40, 41, 42, 43, 44, 45', 'Color: Black, Brown, White'], specs: ['Material', 'Sole', 'Closure', 'Brand', 'Origin'] }],
  [/women|ladies|lawn|suit|dress|abaya|dupatta|kurti|saree|girl/i, { options: ['Color: Black, White, Red, Pink, Blue, Green', 'Size: S, M, L, XL'], specs: ['Fabric', 'Pieces', 'Dupatta', 'Stitching', 'Care', 'Brand'] }],
  [/men|shirt|trouser|jean|kurta|jacket|shalwar|waistcoat/i, { options: ['Size: S, M, L, XL, XXL', 'Color: Black, White, Navy Blue, Grey'], specs: ['Fabric', 'Fit', 'Care', 'Brand'] }],
  [/kid|toy|baby|child/i, { options: ['Size: 2-3 Years, 4-5 Years, 6-7 Years, 8-9 Years', 'Color: Blue, Pink, Red, Yellow'], specs: ['Age group', 'Material', 'Safety note'] }],
  [/mobile|phone|case|charger|earbud|cable|accessor/i, { options: ['Compatible model: iPhone 13, iPhone 14, Samsung A54', 'Color: Black, White, Blue'], specs: ['Brand', 'Warranty', 'Material', 'Connector'] }],
  [/electron|gadget|watch|speaker|headphone|camera|laptop|tv/i, { options: ['Color: Black, Silver, Blue', 'Storage: 64GB, 128GB, 256GB'], specs: ['Brand', 'Model', 'Warranty', 'Battery', 'Power', 'In the box'] }],
  [/home|kitchen|decor|furniture|bed|curtain|towel/i, { options: ['Color: White, Grey, Brown, Black', 'Size: Small, Medium, Large'], specs: ['Material', 'Dimensions', 'Weight', 'Care', 'Brand'] }],
  [/beauty|care|skin|perfume|makeup|cream|hair/i, { options: ['Shade: Fair, Medium, Dark', 'Volume: 50ml, 100ml, 200ml'], specs: ['Brand', 'Skin type', 'Ingredients', 'Expiry', 'Country'] }],
  [/grocery|food|dry fruit|spice|honey|oil|tea|health|wellness/i, { options: ['Weight: 250g, 500g, 1kg', 'Pack: Single, Pack of 2, Pack of 3'], specs: ['Brand', 'Origin', 'Shelf life', 'Ingredients', 'Storage'] }],
  [/sport|outdoor|fitness|tactical|camp|gym/i, { options: ['Size: S, M, L, XL', 'Color: Black, Olive Green, Khaki'], specs: ['Material', 'Brand', 'Weight', 'Use'] }],
  [/auto|car|bike|motor/i, { options: ['Compatible with: Honda, Toyota, Suzuki, Universal', 'Color: Black, Silver'], specs: ['Brand', 'Material', 'Fitment', 'Warranty'] }],
];
export const templateFor = (category) => (T.find(([re]) => re.test(category || '')) || [null, { options: ['Color: Black, White', 'Size: S, M, L'], specs: ['Brand', 'Material'] }])[1];
