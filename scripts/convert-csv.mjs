// Usage: node scripts/convert-csv.mjs aaa.csv [out.csv]
// Reads a Markaz/Shopify product export and writes a Mizanora-ready CSV (prices = cost + profit, delivery is added at checkout).
import fs from 'node:fs';
import { parseCsv, buildProducts, productsToCsv, DELIVERY_FEE } from '../lib/importProducts.js';
const [, , inFile, outFile = 'mizanora-products.csv'] = process.argv;
if (!inFile) { console.log('Usage: node scripts/convert-csv.mjs input.csv [output.csv]'); process.exit(1); }
const { format, products } = buildProducts(parseCsv(fs.readFileSync(inFile, 'utf8')), { featuredCount: 8 });
if (!products.length) { console.log(`No products found (format: ${format}).`); process.exit(1); }
fs.writeFileSync(outFile, productsToCsv(products));
const profits = products.map((p) => p.cost?.profit).filter(Boolean);
console.log(`${products.length} products (${format}) -> ${outFile}. Profit Rs ${Math.min(...profits)}-${Math.max(...profits)}, delivery Rs ${DELIVERY_FEE} charged at checkout.`);
