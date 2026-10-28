# MIZANORA Ads API — for website owners / developers

MIZANORA products can now advertise on **your** website: banner ads, video ads,
animation ads and product cards — one script, auto-optimised by click rate.

## 1. Get an API key

The shop owner creates keys in **Admin → Ads API → API Keys**. You give them your
website name; they give you a key that starts with `mza_`. Keys can be revoked at any
time and can be limited to specific ads or an expiry date.

## 2. Inject the script in your `<head>`

```html
<script async src="https://mizanora.vercel.app/api/ads/embed.js?key=mza_YOUR_KEY"></script>
```

That is the whole integration. The script:

- is self-contained (no dependencies, ~9 KB),
- loads lazily (`IntersectionObserver` — ads render only when visible),
- respects `prefers-reduced-motion`,
- shows an "Ad" badge and a close button,
- never blocks your page (any failure is caught and logged once).

## 3. Drop slots where ads should appear

```html
<div data-mz-ads></div>            auto — the server picks the best ad for the slot
<div data-mz-ads="banner"></div>   static banner with headline + button
<div data-mz-ads="video"></div>    HTML5 video: muted autoplay, play button, skip countdown
<div data-mz-ads="animation"></div>  animated banner (float, shine, pulse, wave, marquee…)
<div data-mz-ads="product"></div>   product card (photo, name, price, buy button)
<div data-mz-ads="html"></div>      your own HTML creative (scripts stripped)
```

Slots can appear anywhere in the page — in a sidebar, between posts, in a carousel.
Give a slot `min-height`/width through your own CSS if you want a fixed ad frame.

## 4. No slots? Auto-insert a banner

```html
<script>window.MZADS = { key: 'mza_YOUR_KEY', auto: true, rotate: 8000 };</script>
<script async src="https://mizanora.vercel.app/api/ads/embed.js?key=mza_YOUR_KEY"></script>
```

With `auto: true` a top banner is inserted even if the page has no `[data-mz-ads]`.

## 5. SPA / late-loaded content

```js
window.MZADS_API.refresh();   // re-scan and fill new slots
window.MZADS_API.disable();   // stop everything (e.g. after a consent choice)
```

## 6. What the API returns

`GET /api/ads/serve?key=…&slot=…&count=…` →

```json
{
  "ok": true,
  "rotateMs": 8000,
  "ads": [{
    "id": "a_xxx", "type": "video", "name": "…",
    "headline": "…", "sub": "…", "cta": "Shop now", "href": "/product/xyz",
    "video": { "url": "…mp4", "poster": "…", "muted": true, "loop": true, "skipAfter": 5 },
    "anim": "float", "img": "…", "bg": "#0B6B45",
    "product": { "name": "…", "price": 1299, "comparePrice": 1999, "img": "…", "slug": "…" },
    "token": "keyId.campaignId.expiry.hmac"
  }]
}
```

The `token` is used internally by the script for impression/click tracking. Tracking
endpoints are signed — campaign stats cannot be faked by calling them directly.

## 7. Ad types at a glance

| Type | Creative | Notes |
|---|---|---|
| `banner` | picture + headline + button | responsive, hover lift |
| `video` | mp4/webm | muted autoplay (plays everywhere), poster, skip countdown, loop |
| `animation` | headline + button + 8 CSS animations | float, shine, pulse, wave, marquee, spin, pop, gradient |
| `product` | product photo + name + price + buy button | opens the shop's product page |
| `html` | custom HTML | scripts, handlers, iframes stripped server-side |
| `auto` | any of the above | server ranks by click rate (auto-optimise) |

## 8. Auto-optimisation

Ads with the best click-through rate rotate in more often (weighted random sampling on
a CTR-based score). You don't need to do anything — the shop owner manages it from
**Admin → Ads API → Stats & Auto**.
