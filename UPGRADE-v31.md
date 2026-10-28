# Upgrading to v31 — MIZANORA Ads API

v31 adds **the Ads API**: banner, video and animation ads for MIZANORA products,
served from this shop to **any other website or project**, with automatic
optimisation. It also makes the shopping experience smoother (cart animations,
lazy ad slots, a video ad slot on the deals page).

## What is new

| Where | What |
|---|---|
| `lib/ads.js` | Ad model, ad types (product, banner, video, animation, HTML), 8 CSS animation presets, the auto-optimise engine (CTR-weighted picking), signed impression/click tokens |
| `lib/adsServer.js` | Cached reads (45 s), API keys (SHA-256 hashed, shown once), atomic stats with `FieldValue.increment`, serve pipeline with budget + schedule + key rules |
| `/api/admin/ads` | Admin CRUD: campaigns, keys, master switches, stats, creative preview |
| `/api/ads/serve` | Public (CORS) endpoint: validates the key, picks the best ads, returns signed creatives |
| `/api/ads/embed.js` | The one-line embed script for other websites (also at `/ads/embed.js`) |
| `/api/ads/impression` + `/api/ads/click` | Signed tracking endpoints (tokens cannot be forged) |
| `/admin/ads` | The Ads Manager: Ads / API Keys / Stats & Auto / Embed tabs |
| `components/AdsInject.js` | Loads the shop's own ads (`key=self`) on the home + deals pages |
| `app/globals.css` | Ad creative styles + cart smoothness |
| `firestore.rules` | `/ads` public-read, `/adKeys` + `/adStats` server-only |

## Upgrade steps

1. **Deploy the new files** (or merge this branch). No environment variables are required —
   keys are created in the admin panel. (Optional: `AD_SECRET` to sign stats tokens;
   without it a built-in secret is used.)
2. **Deploy the Firestore rules** from `firestore.rules` (Firebase console → Rules, or
   `firebase deploy --only firestore:rules`). The rules changes are required for the
   public REST fallback read of `/ads`.
3. **Open Admin → Ads API** (new menu item under Selling):
   - **Ads** tab → *New ad* → pick a type:
     - **Product ad** → search a live product, the ad becomes that product's card.
     - **Banner** → headline, background image/colour, button.
     - **Video** → mp4/webm URL, poster, skip countdown, muted autoplay.
     - **Animation** → pick one of 8 CSS animations (float, shine, pulse, wave,
       marquee, spin, pop, gradient).
     - **HTML** → your own creative (scripts/handlers are stripped server-side).
   - **API Keys** tab → create a key (name the website, expiry, which ads it may show).
     The full key is shown **once** — copy it immediately.
   - **Stats & Auto** tab → per-ad views/clicks/CTR, master switches:
     Ads API enabled, Auto-optimise, Show ads on the shop itself, rotation speed.
   - **Embed** tab → the exact snippet to give the other website.
4. **Give the snippet to the other website**:
   ```html
   <script async src="https://YOUR-SHOP/api/ads/embed.js?key=mza_xxx"></script>
   <div data-mz-ads></div>          <!-- auto: server picks the best ad -->
   <div data-mz-ads="video"></div>  <!-- video ad -->
   <div data-mz-ads="animation"></div>
   <div data-mz-ads="product"></div>
   ```
   Slot types: `auto | banner | video | animation | product | html`. Without any slot,
   set `window.MZADS = { key: 'mza_xxx', auto: true }` before the script and a top
   banner is inserted automatically.
5. **Shop itself** (optional): in Stats & Auto, switch on *Show ads on the shop itself*.
   Home gets an auto slot, the deals page gets a video slot. Switch it off any time.

## How auto-optimisation works

Every active ad gets a score:

```
score = 50
      + priority × 12                    (admin-controlled)
      + min(1, CTR × 3) × 40             (clicks per impression, capped)
      + min(20, log10(clicks+1) × 8)     (history bonus)
      + freshness bonus (up to +2, fades over 10 days — new ads get tested)
```

Slots pick ads by **weighted random sampling** on this score: good ads rotate in more
often, bad ads naturally fade out. Per-ad *Auto-optimise* toggles and the master
switch in Stats & Auto control it. Daily impression caps, start/end dates and
per-key campaign allow-lists keep delivery under control.

## Stats integrity

`/api/ads/serve` signs each creative with an HMAC token
(`keyId.campaignId.expiry.mac`). `/api/ads/impression` and `/api/ads/click` verify the
token and only then increment — nobody can invent campaign counts by calling the
endpoints directly. Keys are stored as SHA-256 hashes; revocation takes effect
immediately because every serve validates the key doc.

## Notes

- The embed script is fully self-contained: no build step, no npm package. It lazy-loads
  with `IntersectionObserver`, respects `prefers-reduced-motion`, shows an "Ad" badge,
  and has a close button. Failures never break the host page.
- Video ads autoplay muted (they play on every phone), show a play button and a skip
  countdown, and loop by default.
- `key=self` (shop's own pages) is accepted by `/api/ads/serve` only when the request
  origin matches `NEXT_PUBLIC_SITE_URL`, so other websites cannot use it.
- Cache: campaign list revalidates every 45 s (tag `ads`); the admin panel refreshes
  instantly through `revalidateSite(undefined, ['ads'])`.

## Blogs & images (v31b)

- **New blog posts** about **Muaaz Iqbal**:
  - `content/blog/muaaz-iqbal-birthday-27-november-2009-age.md` — born **27 November 2009**,
    currently **16** (turns 17 on 27 November 2026), with an image (front matter `image:`).
  - `muaaz-iqbal-biography-profile-projects-skills.md` updated with the birth date and an image.
  - Blog cards on `/blog` and the BlogPosting JSON-LD now use each post's `image:`.
- **Admin → Images** (new, Content group): add **image links** (no upload). Group `muaaz`
  pictures appear on **/muaaz-iqbal** (gallery), in the **home feed** ("Muaaz Iqbal" photo
  cards) and in the **image sitemap** (`sitemap.xml`), so Google Images / search find them.
- `/muaaz-iqbal` also carries `birthDate: 2009-11-27` in its structured data.
- Firestore rules: `/siteImages/{id}` public read, admin write.
