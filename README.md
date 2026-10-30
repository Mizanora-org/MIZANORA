# MIZANORA Store

<p align="center">
  <a href="https://mizanora.vercel.app"><img alt="Live site" src="https://img.shields.io/website?url=https%3A%2F%2Fmizanora.vercel.app&label=mizanora.vercel.app&style=for-the-badge&up_message=live&up_color=0b6b45&down_message=down&down_color=b42318"></a>
  <a href="https://github.com/muaaziqbalvip/MIZANORA/actions"><img alt="Checks" src="https://img.shields.io/github/actions/workflow/status/muaaziqbalvip/MIZANORA/ci.yml?label=checks&style=for-the-badge"></a>
</p>

<p align="center">
  <a href="https://github.com/muaaziqbalvip/MIZANORA"><img alt="GitHub stars" src="https://img.shields.io/github/stars/muaaziqbalvip/MIZANORA?style=flat-square&logo=github&color=0b6b45"></a>
  <a href="https://github.com/muaaziqbalvip/MIZANORA/forks"><img alt="Forks" src="https://img.shields.io/github/forks/muaaziqbalvip/MIZANORA?style=flat-square&logo=github"></a>
  <a href="https://github.com/muaaziqbalvip/MIZANORA/issues"><img alt="Open issues" src="https://img.shields.io/github/issues/muaaziqbalvip/MIZANORA?style=flat-square"></a>
  <a href="https://github.com/muaaziqbalvip/MIZANORA/pulls"><img alt="Pull requests" src="https://img.shields.io/github/issues-pr/muaaziqbalvip/MIZANORA?style=flat-square"></a>
  <a href="https://github.com/muaaziqbalvip/MIZANORA/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/muaaziqbalvip/MIZANORA?style=flat-square"></a>
  <a href="https://github.com/muaaziqbalvip/MIZANORA"><img alt="Repo size" src="https://img.shields.io/github/repo-size/muaaziqbalvip/MIZANORA?style=flat-square"></a>
</p>

<p align="center">
  <a href="https://nextjs.org"><img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=nextdotjs"></a>
  <a href="https://tailwindcss.com"><img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-3-38bdf8?style=flat-square&logo=tailwindcss"></a>
  <a href="https://firebase.google.com"><img alt="Firebase" src="https://img.shields.io/badge/Firebase-Firestore%20%2B%20RTDB-ffca28?style=flat-square&logo=firebase"></a>
  <a href="https://mizanora.vercel.app/api/github"><img alt="Live GitHub feed" src="https://img.shields.io/badge/GitHub-live%20feed-0b6b45?style=flat-square&logo=github"></a>
  <a href="https://mizanora.vercel.app/live-channel"><img alt="Live channel" src="https://img.shields.io/badge/Live%20channel-Quran%20%26%20Hadith-e5484d?style=flat-square"></a>
</p>

Next.js 15 (App Router) + Tailwind + Firebase + Meta Pixel/CAPI + installable PWA. See SETUP.md.
Checks without installing: `node scripts/check.js` (syntax and imports).

## Background music (Admin > Music)
- **Admin > Music** has two cards: **App background music** (plays across the whole shop) and **Reels background music** (plays behind the reels that have no sound of their own).
- The admin only pastes a **direct audio link** (`.mp3`, `.m4a`, `.ogg`, `.wav`). Google Drive and Dropbox share links are converted automatically. Cloudinary (free) is the easiest host.
- The shopper gets a **music button in the header** to switch it off; the choice is remembered on their device (`mz_app_music`).
- Browsers never play sound before the first tap, so the music starts after the first touch. While a full-screen reel is open the background music steps aside (the reel has its own music).
- Stored in Firestore: `siteMeta/appMusic` and `siteMeta/reelMusic` (read by everyone, written only by the admin). Optional fallback: `NEXT_PUBLIC_APP_MUSIC_URL` / `NEXT_PUBLIC_REEL_MUSIC_URL`.

## Search
- The header search understands English, Roman Urdu and Urdu words, colours, price limits ("under 2k"), "sasta / premium", and forgives spelling mistakes (`lib/search.js`).
- **Keyboard:** `↑`/`↓` move through the suggestions, `Enter` opens the highlighted one, `Esc` closes the panel.
- The typed words are **highlighted** in the product names, a matching **category** is offered as its own row, and the panel scrolls on small screens.
- A colour that you type really filters: "black joota" no longer brings the blue shoes along.
- The results page shows `12 products for "laal suit"`, and when nothing is found it suggests the other shelves and the AI assistant.

## Firestore reads (quota saver)
Products/banners/reels are read from Firestore ONCE and shared by all pages through Next's data cache (tag `catalog`, see `lib/products.js`).
Visitors and bots never trigger Firestore reads. The cache refreshes when the admin saves something (`/api/revalidate`) or after 12 hours
(change with env var `CATALOG_CACHE_SECONDS`). Admin lists are cached in the browser session and updated locally after saves; orders load 50 at a time.

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

- `npm run check` — both checks in one go.
- `npm test` — import, voice, music, app music and search tests.
- `npm run build:offline` — a build that does not need the internet (the fonts are mocked). Use the normal `npm run build` for the real deploy, so the real fonts are downloaded.

## v32 upgrade (photos + video ads + big catalogue)

See [UPGRADE-v32.md](UPGRADE-v32.md). In short:

- **Every photo gets three chances**: the optimizer, the browser loading it directly, and the shop's own relay `/api/img` (hotlink blocks, expired links, `http:` links). No more empty cards, banners or cart thumbnails.
- **Video ads play for real**: MP4/WebM, live `.m3u8` (hls.js served by the shop) and YouTube / Facebook / Instagram / TikTok / Vimeo / Drive embeds, a working play button, poster, mute, skip — and the rotation waits while the video is playing.
- **Editing a video ad no longer wipes its video link**, ad links are absolute, and `key=self` respects the "Show ads on the shop itself" switch.
- **The product feeds and `/catalog.json` are paged** (`?part=N`): the old 9 MB / 16 MB / 7.6 MB files were refused by the platform limit (~4.5 MB), so Merchant Center / Commerce Manager got nothing.
- Build errors in `components/LiveTvPlayer.js` fixed; the flaky ad test and two out-of-date CI tests fixed.

## v30 upgrade

See [UPGRADE-v30.md](UPGRADE-v30.md) for Live TV themes and backup sources, Noor's limited/AI modes, richer product details, date-range archive export/deletion and safety notes. Archive range operations affect repository files only, not Firebase copies.

## v33 upgrade (pure-live badges + GitHub on the website)

- **One live badge everywhere.** `components/LiveBadge.js` + `lib/liveBadges.js` draw every `LIVE / SOON / NEW / OFF AIR` label on the shop: a red dot that beats, a slow sheen, amber for "starts soon", green for new. All CSS, all switched off for `prefers-reduced-motion`.
- **The live bar** (`components/LiveStrip.js`) sits under the hero on the home page and on `/live`: pulsing badge, what is playing now (tilawat / hadees / product ad) with a real progress bar, minutes left and "phir ..." (what is next), the Pakistan clock ticking every second, the live TV channel count and the channel's own ticker in a marquee. The program comes from the same wall clock as `/live-channel`, so it is never a made-up number.
- **Reels look live:** cards carry `TRENDING` (first card), `NEW` (fresh) and a real `-20% OFF` badge (only when `comparePrice > price`); the full-screen viewer shows `PLAYING / PAUSED`.
- **Live TV:** a pulsing `LIVE / CONNECTING / RETRY` ribbon on the picture, `ON AIR` + group badges on `/live/<channel>`, and the clock is no longer hidden on phones.
- **GitHub is part of the site now.**
  - `GET /api/github` - the public profile, repositories, stars, languages and last push, cached 30 minutes (`X-GitHub-Live`, `?bare=1` for a tiny badge request).
  - `<GitHubLive />` on `/muaaz-iqbal` (8 repos) and `/team` (4 repos): avatar, followers, stars, forks, language bar, NEW / ACTIVE / MIT / LIVE DEMO badges and "2 ghante pehle" notes.
  - `GitHub` is in `SITE.social` (footer icon + `/connect`), and `POST /api/revalidate` accepts tag `github` to refresh instantly.
  - Optional env: `GITHUB_USER`, `GITHUB_PINNED` (comma separated, the repos shown first), `GITHUB_CACHE_SECONDS`, `NEXT_PUBLIC_GITHUB_URL`.
  - If GitHub is unreachable the section renders from `FALLBACK_REPOS`, so the page is never empty.
- Tests: `node scripts/test-v33.mjs` (badges, clock, live bar, reel badges, GitHub model, hydration safety).
