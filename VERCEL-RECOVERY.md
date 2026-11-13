# Mizanora: offline recovery aur Vercel usage

## Pehle current problem confirm karein

Repo ke v60/v61 notes mein November 2026 ki **purani** Vercel usage overages hain. Un numbers ya GitHub ka successful build dekh kar aaj ke account ka pause ya quota confirm nahi hota. Vercel dashboard → **sahi team/project → Usage, Deployments aur Runtime Logs** dekhein:

1. Domain kis production project/deployment par point karta hai, aur deployment `Ready` hai? Homepage, `/products` aur `/api/health` ka actual HTTP status/log check karein.
2. Agar dashboard mein fair-use pause/overage hai, wahin reason aur reset date dekhein; zarurat par Vercel Support se unpause/options poochein. Billing/plan upgrade owner ka decision hai; code plan ya platform limits change nahi kar sakta.
3. Agar Vercel active hai, runtime logs mein Firebase/Realtime Database failures aur project ke `SITE_MODE` environment variable (ya Admin → Control mein maintenance mode) check karein. Browser ki offline screen connection failure **ya** slow/unavailable server ki wajah se aa sakti hai.
4. Changes ko review/merge karke production mein deploy karein. New service worker tabhi visitors tak pahunchega jab unka browser updated `/sw.js` download kar sake. Deploy ke baad reload karke fresh browser aur existing installed PWA dono test karein. Cart bachane ke liye blanket “clear all site data” na karein.

## Code mein kya badla

- Service worker ab 8 seconds baad har slow uncached page ko offline nahi samajhta: saved public page ke liye 3s fallback, aur bina saved page ke network ko 20s milte hain. Late successful response background mein save hota hai. Sirf explicitly public/cacheable pages save hote hain; `no-cache` reload par stale copy nahi dikhai jati. Waqt par milne wala real HTTP error (jaise 402/503) offline ke taur par nahi dikhaya jata; timeout pehle ho to stale copy ya fallback aa sakta hai.
- Offline fallback `/offline.html` ek chhota standalone page hai jo middleware aur RTDB par depend nahi karta; Next/Firebase unavailable hon tab bhi retry button mil sakta hai. Agar precache fail ho, worker ka built-in fallback hai. Saved copies stale ho sakti hain. Checkout, cart, account, tracking, worker, wishlist, admin, APIs aur arbitrary query URLs cache nahi hote. Cache sizes bounded hain.
- RTDB blocklist read ki middleware deadline 1.2s hai. Failure par known blocks retained rehte hain, lekin cold instance par list na mile to request **fail-open** hoti hai; authenticated APIs ke checks aur rate limits alag se rehte hain. Admin blocklist writes list verify na hone par fail-closed hoti hain. RTDB ko reliable rakhna phir bhi zaroori hai.
- Layout aur home ke independent reads parallel hain. Home shelves ab poora catalog baar-baar sort nahi karte. Live TV banner sirf 14 channel previews bhejta hai; player ka complete channel list rehta hai. Same song-mirror searches in flight share hote hain.
- Product cards ka hover/touch prefetch active page session mein 6 requests per rolling minute tak limited hai; data-saver aur 2G par speculative requests band hain. Actual product link phir bhi khulta hai. Reload/remount par budget reset hota hai; doosre tabs aur doosri traffic is limit mein shamil nahi.
- `CATALOG_CACHE_SECONDS` unset, invalid, ya 86400 se kam ho to 86400 seconds use hote hain (upper bound one year). Settings-only admin refresh sirf selected tags invalidate karta hai; product save ka full refresh barkarar hai.

## Limits ke baare mein zaroori baat

- Aaj ki plan limits, reset rules aur actual consumption dashboard se verify karein. Code koi fixed bill/usage ya uninterrupted service guarantee nahi deta. ISR aur origin transfer traffic, cache hits, media relay aur admin invalidation par depend karte hain.
- Build mein kuch paths hi prerender hote hain, magar naye product/movie/channel URLs first request par ban sakte hain. 500,000-title sitemap aur crawlers ki traffic se bahut unique pages ban sakte hain; pre-rendered page count akela monthly ISR budget nahi batata.
- `data/imdb-ids.txt` ki weekly `[skip vercel]` commit deployment nahi banati. Updated file live sitemap mein **agle deployment** ke baad aayegi, immediately nahi.
- Current usage zyada ho to dashboard mein top routes aur cache-hit metrics check karein. `NEXT_PUBLIC_TV_RELAY=off` ek emergency bandwidth switch hai, lekin jin streams ko relay chahiye wo nahi chalengi; owner trade-off samajh kar hi use kare.

## Local verification

```sh
npm ci
npm test
npm run check
CATALOG_CACHE_SECONDS=600 npm run build  # legacy 10-minute setting ke bawajood ISR floor verify karein
```

Build ke baad `.next/prerender-manifest.json` mein actual `initialRevalidateSeconds` dekh sakte hain. Local sandbox mein Firebase credentials aur third-party networks available na hon, to local results production usage ya backend status ka substitute nahi hain.
