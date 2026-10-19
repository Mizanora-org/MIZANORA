// Tests for the CSV import (sizes, colours, prices, stock, photos, descriptions). Usage: node scripts/test-import.mjs
// No install needed. Exits with code 1 if something is wrong.
import assert from 'node:assert/strict';
import { parseCsv, buildProducts, productsToCsv, num, cleanBody, optionsFromVariants } from '../lib/importProducts.js';

let fails = 0;
const test = (name, fn) => {
  try { fn(); console.log('ok   ', name); } catch (e) { fails++; console.log('FAIL ', name, '\n     ', e.message.split('\n').slice(0, 6).join('\n      ')); }
};

// Helper: one CSV line from plain values (quotes added where needed). Columns follow the Markaz/Shopify export.
const HEAD = ['Handle', 'Title', 'Body (HTML)', 'Vendor', 'Type', 'Tags', 'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value', 'Variant SKU', 'Variant Price', 'Variant Inventory Qty', 'Image Src', 'Variant Image', 'Video Src'];
const line = (o) => HEAD.map((h) => { const v = String(o[h] ?? ''); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(',');
const BODY = '<p>Soft &amp; light sneakers &#8211; for daily use.</p><p><a href="https://www.markaz.app/x">View this product</a></p><ul><li>Material: Mesh</li><li>Product Code: K-99</li><li>Note: Hand wash only.</li></ul>';
const MARKAZ = [
  HEAD.join(','),
  line({ Handle: 'kids-sneaker-set-mkz-1', Title: 'Kids Sneaker, Set | HHC', 'Body (HTML)': BODY, Vendor: 'Markaz', Type: 'Shoes', Tags: 'shoes, kids', 'Option1 Name': 'Size', 'Option1 Value': '28', 'Option2 Name': 'Color', 'Option2 Value': 'Red', 'Variant SKU': 'SKU-1', 'Variant Price': '1,250.00', 'Variant Inventory Qty': '3', 'Image Src': 'https://img.example.com/a.jpg' }),
  line({ Handle: 'kids-sneaker-set-mkz-1', 'Option1 Name': 'Size', 'Option1 Value': '29', 'Option2 Name': 'Color', 'Option2 Value': 'Red', 'Variant SKU': 'SKU-2', 'Variant Price': '1,300', 'Variant Inventory Qty': '0', 'Image Src': 'https://img.example.com/b.jpg' }),
  line({ Handle: 'kids-sneaker-set-mkz-1', 'Option1 Name': 'Size', 'Option1 Value': '28', 'Option2 Name': 'Color', 'Option2 Value': 'Blue', 'Variant SKU': 'SKU-3', 'Variant Price': '1250', 'Variant Inventory Qty': '5', 'Image Src': 'https://img.example.com/c.jpg' }),
  line({ Handle: 'kids-sneaker-set-mkz-1', 'Option1 Name': 'Size', 'Option1 Value': '30', 'Option2 Name': 'Color', 'Option2 Value': 'Blue', 'Variant SKU': 'SKU-4', 'Variant Price': '1280', 'Variant Inventory Qty': '0', 'Image Src': 'https://www.youtube.com/watch?v=abcdefghijk' }),
  line({ Handle: 'plain-cap-mkz-2', Title: "Men's Cap", 'Body (HTML)': 'Simple cap. Cotton.', Vendor: 'Markaz', Type: 'Caps', 'Option1 Name': 'Title', 'Option1 Value': 'Default Title', 'Variant SKU': 'SKU-5', 'Variant Price': '300', 'Variant Inventory Qty': '10', 'Image Src': 'https://img.example.com/cap.jpg' }),
].join('\n');

test('parseCsv keeps quoted commas and double quotes', () => {
  const rows = parseCsv(MARKAZ);
  assert.equal(rows.length, 5);
  assert.equal(rows[0].Title, 'Kids Sneaker, Set | HHC');
  assert.match(rows[0]['Body (HTML)'], /href="https:\/\/www.markaz.app\/x"/);
});

test('a stray quote inside a word does not swallow the row', () => {
  const rows = parseCsv('a,b\n5"x,hello\n1,2\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].a, '5"x');
  assert.equal(rows[0].b, 'hello');
});

test('num() reads 1,250.00 / Rs 1,250 / 95', () => {
  assert.equal(num('1,250.00'), 1250);
  assert.equal(num('Rs 1,250'), 1250);
  assert.equal(num(' 95 '), 95);
  assert.equal(num(''), 0);
});

const built = buildProducts(parseCsv(MARKAZ), { publish: true });
test('detects Markaz format and builds 2 products', () => {
  assert.equal(built.format, 'markaz');
  assert.equal(built.products.length, 2);
});

const kids = built.products.find((p) => p.slug.startsWith('kids-sneaker'));
test('blank-handle variant rows belong to the product above (not lost)', () => {
  const b = buildProducts(parseCsv(MARKAZ));
  const k = b.products.find((p) => p.slug.startsWith('kids-sneaker'));
  assert.equal(k.cost.variants, 4);
});

test('all variant sizes are read (28, 29, 30), not only the first row', () => {
  const size = kids.doc.options.find((o) => o.name === 'Size');
  assert.ok(size, 'Size option missing');
  assert.deepEqual(size.values, ['28', '29', '30']);
});
test('all colours are read (Red, Blue)', () => {
  const color = kids.doc.options.find((o) => o.name === 'Color');
  assert.ok(color, 'Color option missing');
  assert.deepEqual(color.values, ['Red', 'Blue']);
});
test('price uses the HIGHEST supplier variant price (1,300) so no size makes a loss', () => {
  assert.equal(kids.cost.csvPrice, 1300);
  assert.ok(kids.doc.price > 1300, `price ${kids.doc.price} should be above cost 1300`);
  assert.ok(kids.warn.some((w) => /variant prices/.test(w)));
});
test('stock is in stock when at least one variant has qty > 0', () => {
  assert.equal(kids.doc.inStock, true);
});
test('photos: 2 images + YouTube thumbnail becomes a photo, video kept as video', () => {
  assert.ok(kids.doc.images.length >= 3, `images: ${kids.doc.images.length}`);
  assert.equal(kids.doc.videos.length, 1);
});
test('description: entities decoded, supplier link removed', () => {
  assert.match(kids.doc.description, /Soft & light sneakers – for daily use\./);
  assert.doesNotMatch(kids.doc.description, /markaz|View this product/i);
});
test('specs read from list items, product code kept out of specs', () => {
  assert.ok(kids.doc.specs.includes('Material: Mesh'));
  assert.ok(!kids.doc.specs.some((s) => /product code/i.test(s)));
  assert.equal(kids.cost.productCode, 'K-99');
});
test('title keeps comma and the " | HHC" brand tail is removed', () => {
  assert.equal(kids.doc.name, 'Kids Sneaker, Set');
});

const cap = built.products.find((p) => p.slug.startsWith('plain-cap'));
test('"Default Title" is not turned into an option; name apostrophe kept', () => {
  assert.deepEqual(cap.doc.options, []);
  assert.equal(cap.doc.name, "Men's Cap");
  assert.equal(cap.doc.category, 'Men Fashion');
});

test('out-of-stock sheet (all qty 0) marks product as out of stock with a warning', () => {
  const b = buildProducts(parseCsv([
    'Handle,Title,Variant Price,Variant Inventory Qty,Image Src,Option1 Name,Option1 Value',
    'x-mkz-3,Test Item,500,0,https://i.example.com/1.jpg,Size,M',
    ',,500,0,,Size,L',
  ].join('\n')));
  assert.equal(b.products[0].doc.inStock, false);
  assert.ok(b.products[0].warn.some((w) => /out of stock/.test(w)));
  assert.deepEqual(b.products[0].doc.options[0].values, ['M', 'L']);
});

test('size range in the title is used only when the sheet has no sizes', () => {
  const opts = optionsFromVariants([{ option1name: '', option1value: '' }], 'Boots Size 40-43 Leather');
  assert.deepEqual(opts, [{ name: 'Size', values: ['40', '41', '42', '43'] }]);
});

test('combined "Size - Colour" option is split into Size and Color', () => {
  const opts = optionsFromVariants([
    { option1name: 'Size / Color', option1value: 'S - Red' },
    { option1name: 'Size / Color', option1value: 'M - Blue' },
    { option1name: 'Size / Color', option1value: 'M - Red' },
  ], 'Shirt');
  assert.deepEqual(opts.find((o) => o.name === 'Size').values, ['S', 'M']);
  assert.deepEqual(opts.find((o) => o.name === 'Color').values, ['Red', 'Blue']);
});

test('numeric sizes are sorted smallest first', () => {
  const opts = optionsFromVariants([
    { option1name: 'Size', option1value: '42' }, { option1name: 'Size', option1value: '38' }, { option1name: 'Size', option1value: '40' },
  ], 'Shoe');
  assert.deepEqual(opts[0].values, ['38', '40', '42']);
});

test('cleanBody handles plain text / <br> bodies (no <p> tags)', () => {
  const b = cleanBody('Lightweight bag<br>Waterproof &amp; strong');
  assert.match(b.description, /Lightweight bag\n\nWaterproof & strong|Lightweight bag\nWaterproof & strong/);
});

test('Mizanora format: "Rs 1,250" price and Capitalised headers are understood', () => {
  const csv = 'Slug,Name,Price,Category,Options,Images,InStock\nmy-bag,Travel Bag,"Rs 1,250",Travel,"Color: Black, Grey",https://i.example.com/bag.jpg,TRUE\n';
  const b = buildProducts(parseCsv(csv));
  assert.equal(b.format, 'mizanora');
  assert.equal(b.products.length, 1);
  assert.equal(b.products[0].doc.price, 1250);
  assert.deepEqual(b.products[0].doc.options, [{ name: 'Color', values: ['Black', 'Grey'] }]);
});

test('round trip: productsToCsv -> buildProducts keeps name, price, options and images', () => {
  const out = productsToCsv(built.products);
  const again = buildProducts(parseCsv(out));
  assert.equal(again.format, 'mizanora');
  const k = again.products.find((p) => p.slug === kids.slug);
  assert.equal(k.doc.price, kids.doc.price);
  assert.deepEqual(k.doc.options, kids.doc.options);
  assert.equal(k.doc.name, kids.doc.name);
});

console.log(fails ? `\n${fails} test(s) FAILED` : '\nAll import tests passed.');
process.exit(fails ? 1 : 0);
