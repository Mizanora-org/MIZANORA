# MIZANORA Store
Next.js 15 (App Router) + Tailwind + Firebase + Meta Pixel/CAPI + installable PWA. See SETUP.md.
Checks without installing: `node scripts/check.js` (syntax and imports).

## Firestore reads (quota saver)
Products/banners/reels are read from Firestore ONCE and shared by all pages through Next's data cache (tag `catalog`, see `lib/products.js`).
Visitors and bots never trigger Firestore reads. The cache refreshes when the admin saves something (`/api/revalidate`) or after 6 hours
(change with env var `CATALOG_CACHE_SECONDS`). Admin lists are cached in the browser session and updated locally after saves; orders load 100 at a time.

## Promo codes (Admin > Promo codes)
- Every code belongs to a partner (name), has its own discount (percent or flat), min order, max discount, use limit, expiry and optional partner commission %.
- Tick products to make a code work ONLY on those products (a different code per product). Tick nothing = whole shop.
- "Who ordered?" lists every order that used the code (name, phone, city, products, status) with a per-product summary and CSV export.
- Counters (orders, sales, discount given, partner earnings) follow cancelled orders automatically.
- Customers must TYPE the code in the Promo code box at checkout. Nothing is applied automatically, and orders without a code get no discount.
- "One order per phone number" is optional per code.

## Optional: free delivery above an amount
Set `NEXT_PUBLIC_FREE_SHIPPING_OVER` (for example 5000) together with `NEXT_PUBLIC_SHIPPING_FEE`. The cart shows a progress bar and the server uses the same rule.
- Per product: open a product in Admin > Products > Edit and use "Promo codes for this product" to create or see its codes.
