# Mizanora v60 — Speed, weight and polish (the PageSpeed release)

PageSpeed said: **mobile 8, desktop 36**. Everything else on the report was already green
(Accessibility 89, Best Practices 96, SEO 92). So this release is about one thing: **the shop was
carrying far more weight than any phone needs to download, parse and paint**, and the biggest picture
was a full-size supplier JPEG.

v60 makes the shop lighter **without taking anything away** — same products, same pages, same
features, same ads (more of them, in fact), same look.

---

## 1. What was actually wrong (measured, not guessed)

The audit script `scripts/audit-performance.mjs` reads the HTML that `next build` produced and counts
what PageSpeed punishes. The home page before this release:

| Home page | before v60 | after v60 |
|---|---|---|
| HTML | **1,989 KB** | **914 KB** (−54%) |
| DOM nodes | 7,241 | 3,373 (−53%) |
| inline `<svg>` | 894 | 141 (−84%) |
| `<path>` elements | 953 | ~120 |
| images | 185 | 92 |
| **image preloads** (`<link rel=preload as=image>`) | **10** | **2** |
| **font preloads** | **9 (≈320 KB)** | **5 (≈96 KB)** |
| third-party scripts in the first paint | 1 (AdSense, ~160 KB) | 0 (deferred) |
| full-screen splash blocking the first paint | up to 6 s (waited for hydration) | 1 s, CSS-only |

Other pages: `/movies/calendar` 915 KB → 495 KB, `/movies/actors` 861 KB → 439 KB.

---

## 2. The fixes, one by one

### 2.1 Product photos are resized on our own domain (`/api/photo`) — the LCP fix

The catalogue's 21,974 products point at one supplier CDN, and every file there is a **full-size JPEG**
(800–2000 px, 150–500 KB). A card is 200 px wide; a phone needs 400.

New route: `GET /api/photo?u=<https url>&w=400` → fetches the original **once**, resizes it, converts
it to WebP and serves it from mizanora's own domain with a one-year immutable cache.

* widths snap to a short ladder (96…1600) so the edge caches one file per size;
* `sharp` is used when available, and **if anything fails the original bytes are streamed through** —
  a picture can never disappear because of this route;
* SVG/GIF are passed through untouched; EXIF rotation is honoured;
* safety is the same as `/api/img`: https only, no private/local hosts (no SSRF), the answer must be
  an image, 10 MB cap, 9 s timeout, optional `NEXT_PHOTO_HOSTS` allow-list;
* the whole decision lives in `lib/photoServer.js` (`handlePhoto()`), so `scripts/test-v60.mjs` proves
  it end to end with a fake CDN — including that http, `127.0.0.1`, HTML answers and dead hosts are
  refused, and that an SVG is never re-encoded.

`CardMedia`, `CardPhoto`, `RemoteImg`, the category circles and the galleries now use
`photoUrl()` / `photoSrcSet()` from `lib/photo.js` (a 1x + 2x candidate), and the old 3-step
fallback chain (resized → vendor link → `/api/img` relay) is unchanged.

Turn it off with `NEXT_PHOTO_RESIZE=0` (or the public `NEXT_PUBLIC_PHOTO_RESIZE=0`) if a host ever
objects; the shop then loads the original links exactly as before.

### 2.2 One LCP candidate per page, not ten

The home page preloaded **eight remote product photos and two movie posters** at the highest
priority, so the browser downloaded them in parallel with the CSS and the fonts — and the real
largest element arrived last. Now exactly **one** picture is eager (`fetchPriority="high"`): the
first banner. Everything else is `loading="lazy"`. Fixed in: `app/page.js`, `ProductGrid`,
`DealsClient`, `MarketFeed`, `MoviesStrip`, `ReelsRail`, `TitleStubPanel`, `app/winter`,
`MoviePosterCard` rails, `PhotoGallery`.

### 2.3 Fonts: 9 files → 5, and the Arabic files are no longer preloaded

`Inter` 500 and `Jakarta` 600 were dropped (the CSS picks the neighbouring weight), and the two
**100 KB Amiri** files are `preload: false` — they are only used by the Quran/Hadith/Arabic pages, so
the shop pages no longer pull 200 KB of Arabic type before first paint.

### 2.4 The splash screen can no longer delay the first paint

The opening screen waited for React to hydrate, with a 6 s safety timer. On the 2 MB home page that
meant a phone stared at a dark screen while the largest paint was measured. It now fades out with a
**CSS animation at 0.55 s**, JavaScript or not. `SplashControl` still remembers "seen this visit".

### 2.5 AdSense loads when the visitor shows up, not before

The ~160 KB `adsbygoogle.js` was a plain `<script>` in `<head>`. It is now added by
`components/AdSense.js` at the first tap/scroll/key, or when the browser is idle after `load`, with a
4 s fallback so a passive reader still gets ads. The `google-adsense-account` meta tag stays in the
head, so verification is unaffected. `NEXT_PUBLIC_ADSENSE_EAGER=1` restores the old behaviour.

### 2.6 Card icons without 900 `<svg>` trees

A product card carried five lucide icons (heart, share, check, plus, play) — ~750 inline SVGs and
~950 `<path>` elements for 150 cards. They are now five CSS masks (`.ic-heart`, `.ic-share`,
`.ic-check`, `.ic-plus`, `.ic-play`) fed by tiny data-URIs: `<span class="ic ic-heart">`. Same look,
GPU-painted, and the markup of a card dropped by more than half.

### 2.7 Less markup: the home page keeps every section, with fewer cards in each

Six category shelves stay (each 4 products, header links to the full category), deals 6, picks 6,
new 6, "sab se sasti" 8, trending 8, season 6, reels 6, mixed feed 18. **Nothing is unreachable** —
every shelf and strip ends in "View all".

`Marquee` no longer renders its children **twice** (the old −50% loop needed a duplicate copy): the
trending strip is a normal swipe row now; only the thin text ticker above the header still loops.

### 2.8 Cheaper scrolling and painting

* `Header`: `backdrop-blur` removed from the sticky bar (a blur that has to be recomputed on every
  scroll frame is the classic mobile jank source).
* `AppFeel`: the **non-passive `touchmove` listener on `document`** is gone (it made the browser ask
  JavaScript before scrolling) and so is the pinch-zoom blocking.
* `ProductCard` photos no longer run an opacity animation with `fill-mode: both` — that made every
  picture its own composited layer for the life of the page (90 cards = 90 layers).
* `MoviesCalendarClient` receives a slim copy of each title instead of the whole hub object
  (`/movies/calendar` inline payload 745 KB → ~250 KB).

### 2.9 Smaller payloads on the catalogue pages

* `lib/movies.js: slimListMovie()` — the fields a card and the search actually use.
* `/movies/actors` renders 48 profile cards instead of 200 (the deep directory below still lists
  10,000+ people with paging), and portfolio-photo lookups now have a **2.5 s budget** so a slow
  third party can never hold the page.

---

## 3. Accessibility fix (Accessibility 89 → should be 100)

`viewport` had `maximumScale: 1, userScalable: false`. Lighthouse fails that as
*"Prevents zooming and scaling"* — low-vision visitors could not enlarge the text. Pinch-zoom is
allowed again (`app/layout.js`), and nothing in the app cancels the gesture any more.

---

## 4. Ads on every page (jahan bhi content, wahan ad)

* `components/AdsInject.js` now refuses to render on `/checkout`, `/cart`, `/thank-you`, `/track`,
  `/account`, `/admin`, `/offline`, `/connect` (AdSense policy + buyer's peace of mind).
* The layout adds **one ad slot at the end of every page** (`<HideOnAdmin>`), and the shopping pages
  add their own inline slot: `/products`, `/category/[slug]`, `/product/[slug]`, `/movies`.
* `public/ads/embed.js` **collapses a slot that gets no ad** (`min-height: 0`), so a page never shows
  an empty 90 px gap when the shop has nothing running — and expands again when an ad arrives.
* `ProductAds` (a strip of the shop's own products) was added to 15 more pages: about, faq, contact,
  shipping, returns, size-guide, reviews, team, news, islamic, winter, stats, reels, songs, workers.
  Together with the existing ones (blog, tools, live, quran, hadith, search, movies, deals) the shop's
  catalogue now appears on **every content page**.

---

## 5. Movies: all actors under the hub

The Movies hub used to show **12** featured actors. Now:

* the featured rail shows 18;
* a new **"All Actors, Actresses & Directors"** section lists 60 people right under the hub, with
  **A–Z letter chips** (`/movies/actors?letter=a`) and a link to the full directory;
* the numbers come from the committed IMDb cast snapshot (10,000+ real people with 3+ titles), so the
  section is never empty even when Cinemeta is unreachable.

---

## 6. How to check it yourself

```bash
npm run build            # or npm run build:offline
npm run perf             # the weight table for every built page
npm run perf:budget      # exits 1 if a page breaks the v60 budget
npm test                 # includes scripts/test-v60.mjs
```

The budgets (`scripts/audit-performance.mjs`) are the contract this release is held to: home
≤ 1100 KB / 4200 nodes / 400 SVGs / 2 image preloads / 5 font preloads / 0 third-party scripts,
other pages ≤ 700 KB.

---

## 7. Environment switches added

| variable | default | meaning |
|---|---|---|
| `NEXT_PHOTO_RESIZE` | on | `0` turns the `/api/photo` resizer off (original links are used again) |
| `NEXT_PHOTO_HOSTS` | (any public https host) | comma list / `*.domain` to restrict which hosts the resizer may fetch |
| `NEXT_PUBLIC_ADSENSE_EAGER` | off | `1` loads AdSense immediately, as before v60 |

---

## 8. Files touched (short list)

`app/api/photo/route.js` (new), `lib/photo.js` (new), `lib/photoServer.js` (new),
`scripts/audit-performance.mjs` (new), `components/AdSense.js` (new),
`components/{CardMedia,CardPhoto,RemoteImg,ProductCard,Marquee,Header,AppFeel,PhotoGallery,AdsInject}.js`,
`app/{layout,page}.js`, `app/winter/page.js`, `app/movies/{page,calendar/page}.js`,
`app/movies/actors/page.js`, `app/products/page.js`, `app/category/[slug]/page.js`,
`app/product/[slug]/page.js`, `app/api/ads/embed.js` (collapse empty slots),
`lib/{movies,moviesServer}.js`, `app/globals.css`, 15 info pages (ProductAds), and the release tests.
