// Usage: node scripts/convert-csv.mjs aaa.csv [out.csv]
// Reads a Markaz/Shopify product export and writes a Mizanora-ready CSV (prices = cost + profit, delivery is added at checkout).
import fs from 'node:fs';
import { parseCsv, buildProducts, productsToCsv, DELIVERY_FEE } from '../lib/importProducts.js';
// Usage: node scripts/convert-csv.mjs a.csv [b.csv ...] --out=result.csv [--tiers=2400:200,Infinity:300]
// Several input files are merged into one output (every product is kept).
const args = process.argv.slice(2);
const flag = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1];
const files = args.filter((a) => !a.startsWith('--'));
const outFile = flag('out') || 'mizanora-products.csv';
const tiers = flag('tiers') ? flag('tiers').split(',').map((t) => t.split(':')).map(([u, p]) => [u === 'Infinity' ? Infinity : Number(u), Number(p)]) : undefined;
if (!files.length) { console.log('Usage: node scripts/convert-csv.mjs input.csv [more.csv] --out=output.csv [--tiers=2400:200,Infinity:300] [--deduct=250] [--min=100]'); process.exit(1); }
const { format, products } = buildProducts(files.flatMap((f) => parseCsv(fs.readFileSync(f, 'utf8'))), { featuredCount: 8, tiers, deduct: Number(flag('deduct')) || 0, minProfit: flag('min') ? Number(flag('min')) : undefined });
if (!products.length) { console.log(`No products found (format: ${format}).`); process.exit(1); }
fs.writeFileSync(outFile, productsToCsv(products));
const profits = products.map((p) => p.cost?.profit).filter(Boolean);
console.log(`${products.length} products (${format}) -> ${outFile}. Profit Rs ${Math.min(...profits)}-${Math.max(...profits)}, delivery Rs ${DELIVERY_FEE} charged at checkout.`);
