# Product import (CSV) - quick guide

1. Firestore > Rules: paste the new `firestore.rules` (adds `productCosts`) with YOUR admin UID/email > Publish.
2. Vercel > Environment Variables: set `NEXT_PUBLIC_SHIPPING_FEE` = 250 (or delete it) > Redeploy.
3. Open `/admin/import`, choose `mizanora-products.csv` (or the raw Markaz CSV). Check prices, change the profit of any product (Rs 200-500), press Import.
4. Direct from your PC: `npm i` then `node scripts/import-products.mjs file.csv --dry` (preview) and without `--dry` (write). Needs FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY / NEXT_PUBLIC_FIREBASE_PROJECT_ID.
5. Convert only: `node scripts/convert-csv.mjs aaa.csv out.csv`.

Pricing: shop price = supplier cost + profit (tiers in lib/importProducts.js). Delivery Rs 250 is added at checkout.
Supplier cost, SKU and source link are saved in the admin-only `productCosts` collection, never on the public product.
Google: Merchant Center > Products > Feeds > scheduled fetch > https://YOUR-DOMAIN/api/feed/google
