// Direct import into Firestore from your computer (no admin panel needed).
// Usage:  FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY="..." NEXT_PUBLIC_FIREBASE_PROJECT_ID=... node scripts/import-products.mjs aaa.csv [--dry]
// Accepts a Markaz/Shopify CSV or a Mizanora CSV. Needs:  npm i  (firebase-admin is already a dependency)
import fs from 'node:fs';
import { parseCsv, buildProducts } from '../lib/importProducts.js';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const file = process.argv[2], dry = process.argv.includes('--dry');
if (!file) { console.log('Usage: node scripts/import-products.mjs file.csv [--dry]'); process.exit(1); }
const { format, products } = buildProducts(parseCsv(fs.readFileSync(file, 'utf8')), { featuredCount: 8 });
console.log(`${products.length} products (${format})`);
if (dry) { for (const p of products) console.log(p.slug, p.doc.price, p.cost ? `(cost ${p.cost.cost} + ${p.cost.profit})` : ''); process.exit(0); }
initializeApp({ credential: cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n') }) });
const db = getFirestore();
for (let i = 0; i < products.length; i += 200) {
  const b = db.batch();
  for (const p of products.slice(i, i + 200)) { b.set(db.collection('products').doc(p.slug), p.doc); if (p.cost) b.set(db.collection('productCosts').doc(p.slug), p.cost, { merge: true }); }
  await b.commit();
}
console.log('Done. Open /admin/products, then redeploy or press Refresh so the shop cache updates.');
