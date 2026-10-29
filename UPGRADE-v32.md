# Upgrading to v32 — photos that always load + video ads that really play

v32 is a **fix-and-polish** release. Nothing has to be reconfigured: deploy the
files and every product photo, banner and ad gets a second and third chance to
load, and every video ad plays in a real player (including YouTube, Facebook,
Instagram, TikTok, Vimeo, Drive and live `.m3u8` links).

## The two problems it fixes

### 1. "Image not loading" (products, catalogues, banners, cart)
A photo used to be loaded straight from the supplier's CDN. When that CDN
refused the browser (hotlink protection, expired signature, `http:` link, a
foreign Referer) the shopper saw an empty or broken frame — and on a card grid
a whole product looked broken.

Now every shopper-facing photo has **three chances**:

1. Next's image (or the original URL when the optimizer is off),
2. the browser loading it directly with `referrerPolicy="no-referrer"`,
3. **the shop's own relay** `/api/img?u=…` — the server downloads the picture
   and serves it from the shop's address (cached for 30 days).

Only if all three fail does the element hide itself (`img[data-dead="1"]`) or,
for a product card with a video, fall back to the video card. No broken icons,
no empty grey boxes.

The relay is safe: **https only**, private/local addresses refused (no SSRF),
**images only** (JSON/HTML/scripts are rejected), 8 MB cap, 10 s timeout,
`privateHost` check on redirects. Restrict the hosts it may reach with
`NEXT_IMAGE_PROXY_HOSTS="digitaloceanspaces.com,i.ibb.co"` (optional).

Components wired to it: `CardMedia`, `CardPhoto`, `SafeImg`, the new
`RemoteImg` (gallery, home banners, cart, checkout, search suggestions,
recently viewed, reels) and the ads embed script.

### 2. "Video ads do not load"
The old video creative was a bare `<video src>` with an autoplay attempt and a
play button that **did nothing**. A YouTube link, an `.m3u8` link or a
refused autoplay all ended in a black box. And editing an old video ad **wiped
its video link** (the form kept `videoUrl`, the database stored `video.url`).

Now:

| Fix | Detail |
|---|---|
| Real player | `mp4` / `webm` → `<video muted autoplay playsinline>` + poster + **working** play/pause button + mute button |
| HLS | `.m3u8` plays with **hls.js served by the shop** (`/api/ads/hls.js`, no CDN needed) or natively in Safari |
| Embeds | YouTube (privacy `youtube-nocookie`), Facebook, Instagram, TikTok, Vimeo, Dailymotion, Streamable, Google Drive → their own iframe player |
| Autoplay | muted autoplay where the browser allows it, a visible play overlay where it does not — one tap starts it |
| Never a black box | a broken file shows "This video could not play here. Tap to open the ad." instead of nothing |
| Rotation | the slot **waits while a video is playing** (and gives an embed 20 s) instead of cutting it off mid‑scene |
| Skip | the countdown becomes a working *Skip* button |
| Link loss | editing an ad keeps `video.url` / poster / muted / loop / skip (`cleanAd` accepts `videoUrl`, `video.url`, `video.src`) |
| Admin | the form takes any video link, tells you what it detected (`YouTube detected — plays in the site's own embed player`) and the preview plays it |
| Tracking | impressions use a 15-minute token, clicks a 2-hour token (people read first, the click still counts) |

### 3. The product feeds were too big to arrive at all
`/api/feed` (Meta) was **9 MB**, `/api/feed/google` **16 MB** and `/catalog.json`
**7.6 MB**. A serverless response is limited to about **4.5 MB**, so the platform
refused them: Merchant Center / Commerce Manager received nothing (a 502 that
looks like "the feed is broken").

All three are now **numbered parts** (`lib/feedSplit.js`):

```
/api/feed?part=1        /api/feed/google?part=2        /catalog.json?part=3
```

* each part is a complete, valid file (~2-3 MB),
* the response headers say what you got: `X-Feed-Total`, `X-Feed-Pages`,
  `X-Feed-Page`, `X-Feed-Items`, plus a `Link: rel="next"`,
* each XML file starts with a comment naming the next part,
* `catalog.json` also returns `part`, `pages` and a `next` URL,
* descriptions are trimmed (900 chars Meta, 500 Google) and at most 4 extra
  images per product, which keeps every file well under the limit.

**What to do:** in Merchant Center / Commerce Manager add each part as its own
feed (`?part=1`, `?part=2`, … up to `X-Feed-Pages`). The first part alone is
still a valid feed, so nothing breaks if you do nothing.

## Other fixes in this release

* **Shop-ads switch now respected.** `key=self` used to serve ads on the shop even
  when *Admin → Ads API → Stats & Auto → "Show ads on the shop itself"* was off.
  It is now gated, and `self` also works on a custom domain (`NEXT_PUBLIC_EXTRA_HOSTS`).
* **Ad links are absolute.** `href="/deals"` opened on someone else's website used
  to point at *their* `/deals`; it is now rewritten to the shop origin.
* **Slot types are honoured.** A `data-mz-ads="video"` slot could receive a banner
  with no video (black player). Exact type first, a renderable fallback after.
* **Build errors fixed** in `components/LiveTvPlayer.js`: calls to a state setter
  that does not exist (`setAudioTracks`) and to an undefined ref (`dashPlayerEl`).
* **Two failing CI tests fixed**: the front-matter check now allows optional keys
  (`image:`), and the "no date of birth" rules now match the owner's published
  birthday/profile pages.
* **Live ad images** retry through `/api/img`; email/WhatsApp-style hotlink blocks
  no longer leave an empty ad frame.
* `AdsInject` reserves the slot height (no layout jump) and refreshes on
  client-side navigation.

## Upgrade steps

1. Merge/deploy. **No new environment variable is required.**
2. Optional, only if you want to restrict the image relay:
   `NEXT_IMAGE_PROXY_HOSTS=digitaloceanspaces.com,i.ibb.co,res.cloudinary.com`
3. Optional, only if the shop runs on more than one domain (custom domain +
   `*.vercel.app`): `NEXT_PUBLIC_EXTRA_HOSTS=www.yourshop.com`
4. Open **Admin → Ads API → Ads → Edit** on an existing video ad: the video link
   is now shown. Save it once to store the new shape.

## Files

| Area | Files |
|---|---|
| Image relay | `app/api/img/route.js`, `lib/imgFallback.js`, `components/RemoteImg.js` |
| Big catalogue | `lib/feedSplit.js`, `app/api/feed/route.js`, `app/api/feed/google/route.js`, `app/catalog.json/route.js`, `app/llms.txt/route.js` |
| Photos | `components/CardMedia.js`, `CardPhoto.js`, `SafeImg.js`, `Gallery.js`, `BannerCarousel.js`, `CartClient.js`, `CheckoutClient.js`, `SearchBox.js`, `RecentlyViewed.js`, `ReelsRail.js`, `app/globals.css` |
| Ads | `lib/ads.js`, `lib/adsServer.js`, `app/api/ads/serve/route.js`, `public/ads/embed.js`, `app/api/ads/hls.js/route.js`, `components/AdsInject.js`, `app/admin/ads/page.js` |
| Fixes | `components/LiveTvPlayer.js`, `scripts/test-v24.mjs`, `scripts/test-v26.mjs` |
| Tests | `scripts/test-v32.mjs`, `scripts/test-ads.mjs` |
