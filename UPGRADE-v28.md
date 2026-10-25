# Mizanora v28 — Faster, Cinematic Live TV + Whole-App Fixes

Upgrade: purani files ko is files se replace karein, `npm ci`, GitHub par commit, Vercel deploy.  
Naya package: sirf `hls.js` (local chunk, CDN nahi). Environment variable optional hai (`MZ_TV_DEMO`, neeche). Koi Firebase rules change nahi.

## 1. Live TV ab cinematic hai
- Aik hi player ke andar ab **broadcast screen + channel guide** hai — jaise TV UI:
  - upar MIZANORA brand, channel name, **LIVE/CONNECTING/BUFFERING/NO SIGNAL** status, RELAY badge, level count aur Pakistan time (PKT).
  - beech mein video, loading/gate/failure overlays, product ad overlay aur toast.
  - neeche next/previous, mute, favourites, random, share, PiP, full screen controls; auto-skip toggle aur quality selector.
  - right side sticky **Channel Guide**: search, groups, Favourites/Recents, logos aur pagination. Mobile par video upar aur guide neeche aata hai.
- CSS performance: static gradients, GPU-friendly micro-interactions, `content-visibility` for large playlists, reduced-motion support.

## 2. Faster HLS, no third-party CDN
- `hls.js/light` ab **local dynamic chunk** hai — page kholate hi load hota hai, koi CDN script connection nahi.
- Channel switch kabhi double-load nahi karta; relay fallback `relayIndex` state ke sath same-batch switch hota hai.
- HLS buffer tuned for quick first frame: short buffer, bounded retries, stall fallback to signed relay.
- **Live edge button** aur quality choices: Auto, High, Balanced, Data saver.
- Search/guide use `useDeferredValue` — 800 channels par bhi typing smooth.
- Preconnect only current aur next direct host ke liye.

## 3. Live TV performance aur SEO
- `/live` aur `/live/[slug]` product-ad strip ab `<Suspense>` mein hai — photos player ke opening hold nahi karti.
- `getTvAds()` ab 30 ad products ke liye sequential Firestore calls ki jagah `Promise.all` uses.
- Channel pages `generateStaticParams` + `dynamicParams = true` — saved channels prerender hoti hain, naye channels on-demand generate hoti hain.
- `/live` SEO list se 400 links ka 200/120 link kar diya (heavy UI player guide mein hai).
- `/live-channel` ab static shell hai; browser clock aur 20-second polling same hai.

## 4. Bugs poori app se fixed
- **`/search` 500:** `SURAHS` array of objects hai, tuple `[name, ayat]` nahi — page destructure kar rahi thi. Ab direct `SURAHS` use hota hai.
- **`/search` redirect bug:** `next.config.js` `/search` se permanent redirect kar raha tha — site-wide search page aur uski links reachable nahi thi. Ab redirect removed.
- **Nested `<main>`:** `/live-channel` mein do `<main>` the; ab section shell hai.
- **Relay:** `/api/tv/p` ab viewer disconnect signal ko upstream fetch se lagaye ga — page chukne par proxy request dhoondh rah jaye gi nahi.
- **Admin import:** M3U merge ab duplicates aur `MAX_CHANNELS` limit check karta hai; message accurate hai.
- **Service worker:** registration timers/listeners cleanup ho gai hai — hot reloads mein update loops nahi.
- **Static tooling:** `npm run check` ab `npm ci` ke baghair hard-coded global path pe fail nahi hoga.
- Small type/compatibility fixes: `archive.js`, `search.js`, `sound.js`, `metaPixel.js`, `seo.js`, `quran.js`, `kit.js`, `Reveal.js`.

## 5. Optional demo mode
`.env.example` / Vercel:

```
MZ_TV_DEMO=1
```

- Sirf jab Firebase configure nahi hai ya admin channels save nahi kiye hain, `/live` two public HLS demo streams dikhayega (badge DEMO, ads off).
- Saved channels kabhi override nahi hoti. Production mein default `0` rakhein aur apne licensed channels Admin > Live TV mein add karein.

## 6. Tests
```
npm ci
npm test
npm run check
npm run build:offline
```

New suite: `scripts/test-v28.mjs` — guide filters, quality levels, search crash/redirect, HLS wiring, static pages, relay signal, admin import, package v28.
