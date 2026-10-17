// The shop search: the words it understands, the prices it reads and the words it forgives.
import { describeIntent, didYouMean, parseQuery, smartSearch } from '../lib/search.js';

let bad = 0;
const eq = (a, b, m) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) bad++;
  console.log(ok ? 'ok  ' : 'FAIL', m, ok ? '' : JSON.stringify({ got: a, want: b }));
};

// A small shop to search in.
const list = [
  { id: '1', name: 'Red Lawn Suit 3 Piece', slug: 'red-lawn-suit', category: 'Women Fashion', categories: ['Women Fashion'], price: 2500, options: [{ name: 'Color', values: ['Red'] }] },
  { id: '2', name: 'Black Leather Joota', slug: 'black-joota', category: 'Footwear', categories: ['Footwear'], price: 4500, options: [{ name: 'Color', values: ['Black'] }] },
  { id: '3', name: 'Kids Blue Shoes', slug: 'kids-blue-shoes', category: 'Kids', categories: ['Kids'], price: 1200, options: [{ name: 'Color', values: ['Blue'] }] },
  { id: '4', name: 'Silver Analog Watch', slug: 'silver-watch', category: 'Accessories', categories: ['Accessories'], price: 3000, options: [] },
  { id: '5', name: 'Winter Wool Shawl', slug: 'wool-shawl', category: 'Women Fashion', categories: ['Women Fashion'], price: 1800, options: [] },
];

// ---- the words of a query
eq(parseQuery('red suit').words, ['suit'], 'a colour is not a word');
eq(parseQuery('red suit').colors, ['red'], 'a colour is read as a colour');
eq(parseQuery('laal suit').colors, ['red'], 'the Urdu colour word is understood');
eq(parseQuery('سوٹ suit').words, ['suit'], 'an Urdu word is translated');
eq(parseQuery('suit under 2000').max, 2000, '"under 2000" sets the top price');
eq(parseQuery('suit under 2k').max, 2000, '"under 2k" sets the top price');
eq(parseQuery('suit over 3000').min, 3000, '"over 3000" sets the lowest price');
eq(parseQuery('suit between 1000 and 2000').max, 2000, '"between" sets both prices');
eq(parseQuery('sasta suit').sort, 'low', '"sasta" sorts by the lowest price');
eq(parseQuery('premium suit').sort, 'high', '"premium" sorts by the highest price');
eq(describeIntent(parseQuery('laal suit under 2000')), ['red', 'under Rs. 2000'], 'the shopper sees what was understood');

// ---- finding the right products
eq(smartSearch(list, 'joota').results.map((p) => p.id), ['2', '3'], 'a Roman Urdu word finds the shoes');
eq(smartSearch(list, 'jooty').results.map((p) => p.id), ['2'], 'a spelling mistake still finds the right product');
eq(smartSearch(list, 'watch').results.map((p) => p.id), ['4'], 'the English word finds the product');
eq(smartSearch(list, 'ghari').results.map((p) => p.id), ['4'], 'the Roman Urdu word for a watch works too');
eq(smartSearch(list, 'red suit').results.map((p) => p.id), ['1'], 'a colour and a word work together');
eq(smartSearch(list, 'suit under 2000').results.map((p) => p.id), [], 'the price limit is respected');
eq(smartSearch(list, 'shawl under 2000').results.map((p) => p.id), ['5'], 'the price limit keeps the cheap one');
eq(smartSearch(list, 'black joota').results.map((p) => p.id), ['2'], 'a colour and a Roman Urdu word work together');
eq(smartSearch(list, 'zzzzqqq').results.length, 0, 'a word nobody knows finds nothing');
eq(smartSearch(list, '').results.length, 5, 'an empty query shows everything');

// ---- "did you mean"
eq(didYouMean(list, 'leather jota'), 'leather joota', 'a wrong word is corrected');
eq(didYouMean(list, 'winter shawl'), '', 'a correct sentence is left alone');

if (bad) { console.error(`\n${bad} search test(s) failed.`); process.exit(1); }
console.log('\nAll search tests passed.');
