// Mizanora v61 — THE ISR WRITE BUDGET (documentation + guard rails).
//
// Why this file exists
// --------------------
// 2026-11-09, Vercel ne project dobara pause kiya. Is dafa wajah "Fast Origin Transfer" ke sath
// **ISR Writes** bhi thi:
//
//        ISR Writes            620K / 200K      <-- 3x limit
//        Fast Origin Transfer  23.92 GB / 10 GB
//        Fluid Active CPU      3h 23m / 4h
//
// Hisaab: build ke waqt 534 pages prerender ho rahe thay aur unme se ~500 par `revalidate = 1800`
// (ya 600) laga hua tha. Har prerendered page = 1 ISR write (build) + har expiry par phir 1 write:
//
//        534 pages x 48 writes/day x 30 days ≈ 770,000 writes   (limit 200,000)
//
// Naye niyam (v61)
// ----------------
//  1. JO PAGE SIRF REPO SE BANTA HAI (blog, tools, quran, hadith, islamic, news, sitemaps directory,
//     team, winter, movies/world, reviews, stats, live-channel shell) -> **koi `revalidate` nahi**.
//     Wo build par ek dafa bane aur bas. Content badla = deploy.
//  2. JO PAGE LIVE DATA DIKHATA HAI (home, product, products, category, deals, reels, wishlist,
//     live TV, movies + actors + calendar, songs) -> `revalidate = 86400` (1 din) aur admin save par
//     `/api/revalidate` foran refresh karta hai. Is liye dukaan taza bhi rehti hai aur writes bhi
//     kam: ~150 pages x 1 write/day ≈ 4,500 writes / 30 days.
//  3. PRERENDER SIRF TOP PAGES KA: products 12, categories 12, live channels 24, actors 200.
//     Baqi sab pehli request par banta hai (`dynamicParams`) — Google ke liye farq nahi, sitemap
//     poora catalogue list karta hai.
//  4. WEEKLY DATA COMMIT (data/imdb-ids.txt) me `[skip vercel]` lagta hai, is liye wo rebuild nahi
//     karwata (warna har hafte 534 pages = 534 ISR writes sirf ek txt file ke liye).
//  5. INNER CACHE TTL BHI 1 DIN. Ye sab se ahem niyam hai aur pehle miss ho gaya tha: Next.js har
//     page ka ISR us ke render tree ke sab se CHHOTE `unstable_cache`/`fetch` revalidate tak floor
//     kar deta hai. `app/layout.js` har page par chalta hai, is liye 6-12 ghante wale helpers
//     (catalogue count, reviews, GitHub card) saare "daily" pages ko bhi 6-12 ghante par regenerate
//     karwa rahe thay - build manifest ne {43200: 322} dikhaya jab pages par 86400 likha tha.
//     Ab: manifest {86400: 325}. Koi bhi naya cache `revalidate` 86400 se kam na ho, aur env var se
//     na chale (ek env var poori site ka budget kharab kar deta hai).
//
// IMPORTANT: `export const revalidate` ko **literal number** chahiye (Next build ke waqt parse karta
// hai, import nahi chalta). Is liye har page par literal `86400` likha hai — value badalni ho to
// `grep -rn "export const revalidate" app` se badal dein. `npm run test:v61` in niyamon ko check karta
// hai (koi page 86400 se kam revalidate na rakhe, aur naye prerender caps bhi wahi rahein).

export const REVALIDATE_DAY = 86400; // the single allowed value for live-data pages
export const PRERENDER_CAPS = { products: 12, categories: 12, liveChannels: 24, actors: 200 };

// -----------------------------------------------------------------------------------------------
// v62 — WHERE THE REMAINING LIMITS ACTUALLY GO
// -----------------------------------------------------------------------------------------------
// v61 fixed the O(pages) cost: ~10K ISR writes / 30 days instead of 770K. That part stays exactly
// as it is (`revalidate = 86400` on live-data pages, static repo-only pages). Changing it again is
// NOT the answer to "the free limits are gone in one day": those writes do not grow with traffic.
//
// What DOES grow with traffic is every Function started by a visitor:
//
//   middleware on every request        -> 1 invocation + a full HTML origin transfer per view
//   /api/telemetry page + 60 s beat   -> 1 invocation per page, then 1 per minute per open tab
//   /api/analytics/collect            -> 1 invocation per page (and per SPA route change)
//   /api/ads/embed.js on ad pages     -> 1 invocation per page for a file that is already static
//   /api/ads/serve  (no-store)        -> 1 invocation per ad slot per page
//   weak cache headers on /fonts etc. -> repeated origin transfers of the same bytes
//
// v62 removes all of them from the public request path. Rules for new features:
//
//   1. A public page view must be answerable by the CDN ALONE (no middleware, no beacon, no proxy).
//   2. Anything a browser sends automatically must be sampled + budgeted (`lib/beaconBudget.js`)
//      or served from `public/` as a static file.
//   3. Any response that DOES come out of a Function needs `s-maxage`, or one visitor = one origin
//      transfer.
//   4. Sitemaps and other generated files must carry a STABLE `lastmod`; "today" on every
//      regeneration makes crawlers re-fetch everything and destroys the cache.
//   5. Docs/data-only commits must not trigger a rebuild (`scripts/vercel-ignore.mjs`).
//
// `npm run test:v62` pins these rules. The page-level ISR rules stay pinned by `npm run test:v61`.
//
// Honest limit: Vercel Hobby also meters Fast Data Transfer (CDN bytes to visitors, ~100 GB/month).
// No code can make crores of page views cost zero bytes on ANY host. What this release guarantees is
// that the Function / ISR / Fast Origin Transfer counters no longer scale with the number of
// visitors, so a traffic spike no longer pauses the project. For genuinely unlimited traffic the
// answer is a paid plan or a dedicated CDN — not a code change.
