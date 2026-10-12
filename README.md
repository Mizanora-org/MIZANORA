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

## Season + Islamic theme
The shop changes with Pakistan's seasons automatically (Oct-Nov Khizan/autumn, Dec-Feb Sardi/winter, Mar-Apr Bahar/spring, May-Sep Garmi/summer):
falling leaves / snow / petals, a seasonal hero banner with hanging lanterns, crescent and twinkling stars, a "season picks" shelf built from your
products (it matches words like jacket, sweater, shawl, boots in the product name/category), a seasonal line in the top ticker, scroll animations,
today's Hijri date, a Jumu'ah Mubarak badge on Fridays and a daily verse reminder.
- The look is kept on Khizan (autumn) for now. To change it: `NEXT_PUBLIC_SEASON_THEME` = autumn (default) | auto (follows the months) | winter | spring | summer | off
- Hijri date: Pakistan usually starts the month a day after Saudi Arabia, so the default offset is -1. Change it with `NEXT_PUBLIC_HIJRI_OFFSET` (0, -1, -2).
- Edit the season texts and keywords in `lib/season.js`, and the daily verses in `lib/reminders.js` (please check the Arabic against your Mushaf before adding new ones).
- Animations stop automatically for people who turned on "reduce motion", and they are hidden on admin and checkout pages.

## Smooth and light
Heavy effects were removed: no animated gradients or glows, no full-screen fixed pattern, no blur on every reel. Falling leaves use only a few elements,
fewer on weak phones, none when Data Saver is on, and they pause when the tab is hidden. Visitors can switch them off in the footer ("Seasonal animation").

## Categories and filters
- A product can be in many categories (Admin > Products > Edit > Categories; the first one is the main category). The product shows under each category page, on the home shelves, in search and in the Meta feed.
- /products and category pages have category chips, in-stock / on-sale filters, price range and more sorting options. All of it runs in the browser (no database reads).
- Admin > Products list: one-tap "Mark sold out", "Hide from shop" and "Duplicate".
- Search box remembers recent searches on the shopper's device.

## Checks before deploying
`node scripts/check.js` (syntax and imports) and `node scripts/typecheck.js` (undefined names, missing exports/files) both need only the global `typescript` package.
