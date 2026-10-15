# Mizanora v8: speed, smoothness, fewer Firebase reads

## Why buttons and product taps felt slow with many products
1. Every product card had 3 small React components (heart, share, add). 150 cards = 450 components to start up. Now cards are plain HTML and ONE global listener (`components/CardEvents.js`) handles heart / share / add to cart.
2. Every card link prefetched its page as soon as it appeared on screen (dozens of requests at once). Now a page is prefetched only when a finger or mouse touches the card.
3. The products page sent full descriptions, all photos and videos of every product to the phone. Now only what a card and search need (`lib/cardData.js`).
4. Typing in search and tapping filters blocked the screen. Matching now runs right after typing (`useDeferredValue`), and the search index is prepared once per product (3x faster, same results).
5. `scroll-behavior: smooth` on the whole page made every page change glide slowly. Removed. Phone tap delay and blocked pinch-zoom (`touch-action: pan-x pan-y`) fixed.
6. Off-screen cards are skipped by the browser (`content-visibility`), hover effects only on devices that hover.
7. Firebase login code (about 100 KB) no longer loads with every page; it loads in the background (or at once on account, checkout, worker, admin).
8. Cart split into two contexts: product cards never re-render when the cart changes.
9. Home page: 8 biggest categories get a shelf (8 products each) instead of all categories (10 each).

## Firebase limits (reads)
- **Size-safe catalogue cache.** Next's data cache refuses entries over 2 MB. A big catalogue could pass that, and then every visit would re-read ALL products from Firestore. The catalogue is now read and cached in pages of 100 products (`lib/products.js`).
- If a refresh fails (quota or network) the last good copy is kept, so the shop never turns empty.
- Cache time 6 h -> 12 h (still refreshed instantly when you save in admin). Review cache 30 min -> 6 h.
- Search runs only in the browser: zero Firestore reads. One shared product list (`lib/searchIndex.js`) is fetched once per visit and cached 10 minutes in the browser, 1 hour on the server.
- Only the newest 60 product pages are built at deploy time; the others are built on first visit (fast deploys, no memory problems).
- Admin orders: first load 50 (not 100) orders, "Load 50 older" for more.

## Loading screens
- **Opening screen** (logo, rings, progress bar), shown once per visit, fades out when the shop is ready. Pure HTML/CSS, so it appears on the very first paint.
- **Top progress line** the instant any link is tapped.
- **Skeleton pages** for home, products, category and product (`loading.js`): the next page appears instantly while data loads.

## Also
- Service worker v2: a slow network (8 s+) falls back to the saved page or offline page; build files and photos are cache-first (no wasted background downloads).
- Photos: WebP only, fewer size variants, 30 day cache (faster first view, fewer Vercel image transformations).

## Before deploy
`node scripts/check.js` and `node scripts/typecheck.js` pass. A full `next build` could not be run here (no network), so run `npm install && npm run build` once before deploying.
