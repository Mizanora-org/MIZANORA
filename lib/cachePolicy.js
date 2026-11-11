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
