# Mizanora v60 — the Vercel pause (Fast Origin Transfer) and the fix

> **Kya hua:** 2026-11-08 ko Vercel ne **poora project pause** kar diya (saari deployments 402 /
> "This deployment is temporarily paused"). Wajah build fail nahi thi — code bilkul theek chal raha
> tha. Wajah thi **Hobby plan ki bandwidth limit**: `FAIR_USE_LIMITS_EXCEEDED`,
> `blockedDueToOverageType = fastOriginTransfer`. Pause **2026-12-08** tak hai (30 din).

## 1. Asli wajah (diagnosis)

Vercel team API se mila:

```
plan: hobby
softBlock: {
  blockedAt: 2026-11-08 20:56 UTC,
  reason: "FAIR_USE_LIMITS_EXCEEDED",
  blockedDueToOverageType: "fastOriginTransfer",
  unpauseAt: 2026-12-08 20:56 UTC
}
```

Latest production deployment = `READY` (commit `2079c7f`), GitHub status = success.
Yani **build theek tha, account band tha.**

"Fast Origin Transfer" ka matlab: jo bytes **Function / Middleware se nikal kar CDN tak** jate hain.
Hobby plan me iski allowance ~**10 GB / rolling 30 din** hai. Mizanora me teen aadatain milkar ye
limit cross karwa rahi thin:

| # | Aadat | Kyun mehnga tha |
|---|-------|-----------------|
| 1 | **Photo relay default tha** — `/api/img` ko `CardMedia`, `CardPhoto`, `RemoteImg`, `SafeImg`, `AvatarImg` har photo ke liye use karte the, aur song artwork `cdnProxy()` se **pehle din se hi** proxy hota tha | Har photo ka poora byte ek Function se guzarta tha, CDN cache ke bajaye |
| 2 | **Relayed media par `s-maxage` nahi tha** — `/api/img` aur `/api/tv/p` sirf `max-age` dete the | `s-maxage` ke bina Vercel CDN Function ka jawab **cache nahi karta**; har visitor = nayi origin transfer. Live TV relay ek viewer ke 1 ghante me 1–2 GB kha jata hai |
| 3 | **Middleware har request par** chalta tha (matcher = sab kuch except `_next`/`icons`/`img`) | Har middleware hit = Function invocation + CDN bypass. Har `sitemaps/*.xml`, har `/api/*`, har file par bhi |

Iske sath `next.config.js` me `outputFileTracingIncludes: { '/**': [...] }` tha — 33 MB `data/`
folder **har function** ke bundle me copy hota tha (deploy/cold-start mehnga, transfer nahi — lekin
ab scoped kar diya).

## 2. Fix (jo is release me hai)

### a) Photo relay ab LAST RESORT hai, default nahi — `lib/imgFallback.js`
* Photo pehle apne host se load hoti hai (**0 bytes humare through**).
* Sirf **fail hone ke baad** relay use hota hai.
* Jo host fail hua wo **session me yaad** rakha jata hai (`markBrokenHost`), to us host ki agli photo
  seedha relay se jati hai — dobara fail hone wali request waste nahi hoti.
* Jin hosts ko aap pehle se jante hain ke wo hotlink block karte hain, ek dafa declare kar dein:
  `NEXT_PUBLIC_IMAGE_RELAY_HOSTS=imgbb.com,i.ibb.co`
* Emergency switches: `NEXT_PUBLIC_IMAGE_RELAY=off` (relay band) ya `always` (purana behaviour).

### b) CDN cache ab majboori hai — `next.config.js` + routes
* `/api/img` → `s-maxage=31536000` (ek photo **ek dafa** transfer, phir edge se)
* `/api/poster/*` → `s-maxage=2592000`
* `/api/songs/cdn` → `s-maxage=31536000, immutable`
* `/api/tv/p` → `s-maxage=3600` (signed segment addresses immutable hain, is liye ek download sab ke liye)
* `/api/img` ab body ko **stream** karta hai (buffer nahi) aur `content-length` se pehle hi bara file
  reject karta hai.

### c) Songs: CDN pehle, proxy fallback — `lib/songs.js`
* `songAudioSources()` = **direct CDN link pehle**, phir wahi files `/api/songs/cdn` ke peeche.
* Album artwork direct load hota hai; `imageProxy` field onError fallback ke liye rakhi hui hai.
* Band karna ho to `NEXT_PUBLIC_SONGS_DIRECT=0`.

### d) Live TV relay par budget — `lib/liveTv.js` + `app/api/tv/p/route.js`
* https streams **direct** chalte hain; relay sirf `http://` streams, admin ke `proxy` mark, ya us
  host ke liye jise wo browser pehle play nahi kar saka.
* Ek tab me maximum `RELAY_BUDGET = 3` forced relay attempts — ek dead channel poori allowance
  nahi kha sakta.
* `NEXT_PUBLIC_TV_RELAY=off` se relay bilkul band (jab plan capped ho).

### e) Middleware chhota — `middleware.js`
* Matcher ab file extensions aur static folders pehle hi skip kar deta hai (skipped request bilkul
  free hai — Function invoke nahi hota).
* Blocklist cache 20s → **60s** per instance.

### f) Function bundles scoped — `next.config.js`
* `'/**'` ki jagah sirf wahi routes jo `data/` padhte hain (`/api/archive/*`, `/api/admin/*`,
  `/product/*`, `/category/*`, `/sitemaps/*`, …).

## 3. Aap ko ab kya karna hai (deployment wapas lane ke liye)

1. **Vercel dashboard → team `muaaziqbalsuper` → Usage** khol kar dekhein: Fast Origin Transfer
   limit aur reset date (`unpauseAt` = 2026-12-08). Is page par kabhi kabhi **one-time limit
   increase** ka option bhi hota hai; agar mil raha hai to use kar lein — site foran wapas aa jayegi.
2. **Upgrade to Pro** (agar foran chahiye): Pro par origin transfer ka alag bara allowance hai aur
   pause nahi hota. Ye aap ka billing faisla hai.
3. **Vercel Support / community** se manual unpause request: reason batayein "fixed: image/TV relay
   now CDN-cached, middleware scoped, direct-first media" — community me aise requests ka record hai.
4. Ye branch merge + deploy karein (pause ke doran build chal jata hai, traffic band hota hai).
   Deploy ke baad:
   * `NEXT_PUBLIC_IMAGE_RELAY_HOSTS` set karein (jo supplier hosts hotlink block karte hain).
   * Agar allowance bilkul tight ho to `NEXT_PUBLIC_TV_RELAY=off` rakh kar pehla hafta guzarein.
   * Vercel → Usage me daily "Fast Origin Transfer" graph dekhein; ye release ke baad flat rehna
     chahiye jab tak Live TV relay zyada use na ho.

## 4. Yaad rakhne wali baat

Hobby plan par **function se guzarne wala har byte** aap ki bandwidth hai. Naya feature banate waqt
teen sawal poochhein:

1. Kya ye file **CDN se seedha** browser tak ja sakti hai? (to proxy na banayein)
2. Agar proxy lazmi hai, to `s-maxage` diya? (warna CDN cache nahi karega)
3. Kya middleware ko is route par chalna zaroori hai? (nahi to matcher se nikaal dein)

`npm run test:v60` in tamam niyamon ko check karta hai.
