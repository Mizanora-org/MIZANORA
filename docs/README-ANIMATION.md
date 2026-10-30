# README ANIMATION — poori research, ek jagah

Yeh file un sab tareeqon ka nichor hai jo GitHub README ko “live” banate hain. MIZANORA ne
**self-hosted animated SVG** chuna hai (kyunki wo kabhi tootti nahi), magar neeche har tareeqa
uske faide/nuqsan ke sath likha hai — taake aap jo bhi scene banayein, pehle se pata ho.

---

## 0. Sab se pehle: GitHub README kya kya allow karta hai

| Element | GitHub behaviour |
| --- | --- |
| `<script>` | **remove** |
| `<style>` / `<link rel=stylesheet>` / inline `style` on HTML | **strip / ignore** |
| `<img src="*.svg">` | **render** karta hai |
| SVG ke andar `<style>` + `@keyframes` | **chalti hai** |
| SVG ke andar `<animate>`, `<animateTransform>`, `<animateMotion>` (SMIL) | **chalti hai** |
| `<svg>` seedha README mein | sanitize ho jata hai — asli file jaisa control nahi milta |
| CSS classes on README HTML | ignore |
| `<details>`, `<summary>`, `<picture>`, `<picture><source>`, tables | chalta hai |
| Relative image path (`public/x.svg`) | chalta hai (file ke hisab se resolve hota hai) |
| External image | GitHub ke camo proxy se guzarta hai (cache ~5 min) |

**Natija:** animation **SVG file ke andar** likho, README mein sirf `<img>` lagao.

---

## 1. Self-hosted animated SVG (jo MIZANORA use karta hai)

```
public/brand/readme/hero.svg      <- animation isi file ke andar
README.md                         <- <img src="public/brand/readme/hero.svg">
```

Faide:

- koi third-party service nahi, kabhi 404 nahi;
- koi rate limit nahi (GitHub ka camo cache sirf madad karta hai);
- poora control: colours, text, speed, size;
- repo clone karne wale ke paas source bhi hai (`scripts/make-readme-art.mjs`).

Nuqsan:

- animation SVG ke andar hi rehti hai (README ki CSS se control nahi hoti);
- `<script>` nahi, is liye asli data ke liye **GitHub Action** chahiye (neeche #5);
- kuch preview apps (Windows Photos, macOS Preview) animation nahi chalate.

### Animation ke kaam ke patterns

**a) Pulse / live dot**

```svg
<style>
  .dot{animation:mz-live 1.5s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
  @keyframes mz-live{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.62)}}
</style>
<circle class="dot" cx="20" cy="20" r="5" fill="#E5484D"/>
```

**b) Ring jo phailta hai (radar)**

```svg
<style>
  .ring{transform-box:fill-box;transform-origin:center;animation:mz-ring 2.2s ease-out infinite}
  @keyframes mz-ring{0%{opacity:.55;transform:scale(.55)}100%{opacity:0;transform:scale(1.9)}}
</style>
<circle class="ring" cx="20" cy="20" r="5" fill="none" stroke="#fff"/>
```

**c) Typing text** — har harf ko apni opacity + `animation-delay`:

```svg
<style>
  .ch{opacity:0;animation:mz-ch 7s linear infinite both}
  @keyframes mz-ch{0%{opacity:0}1.6%{opacity:1}92%{opacity:1}97%{opacity:0}100%{opacity:0}}
</style>
<text class="ch" x="0"   y="20" style="animation-delay:0s">S</text>
<text class="ch" x="8.4" y="20" style="animation-delay:.06s">h</text>
```

Monospace (`ui-monospace, Menlo, Consolas`) mein har harf ki width barabar hoti hai
(`0.6 × font-size`), is liye position bilkul exact hoti hai — koi text-measuring nahi.

**d) Infinite marquee** — do barabar lines, group poore ek line ke barabar khisakta hai:

```svg
<style>@keyframes tape{from{transform:translateX(0)}to{transform:translateX(-1840px)}}</style>
<g style="animation:tape 30s linear infinite">
  <text x="0" y="0">SHOP SMART ✦ …</text>
  <text x="1840" y="0">SHOP SMART ✦ …</text>
</g>
```

**e) Waveform / equalizer** — ek keyframe, har bar ka apna delay:

```svg
<style>
  .bar{transform-box:fill-box;transform-origin:50% 100%;animation:bar 1.15s ease-in-out infinite}
  @keyframes bar{0%,100%{transform:scaleY(.22)}50%{transform:scaleY(1)}}
</style>
<rect class="bar" style="animation-delay:.09s" x="10" y="10" width="6" height="40" rx="3"/>
```

**f) Ghoomti rings (logo)**

```svg
<style>
  .spin{transform-box:fill-box;transform-origin:center;animation:spin 26s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
</style>
<circle class="spin" cx="60" cy="60" r="57" fill="none" stroke-dasharray="2 9"/>
```

**g) Gradient sheen (shine jo guzarti hai)**

```svg
<rect class="sheen" width="120" height="60" fill="url(#shineGrad)"/>
<style>
  .sheen{mix-blend-mode:screen;animation:sheen 5.5s ease-in-out infinite}
  @keyframes sheen{0%,55%{transform:translateX(-320px)}100%{transform:translateX(620px)}}
</style>
```

### Teen galtiyan jo sab karte hain

1. **`transform-box: fill-box` bhool jana** — SVG shape `(0,0)` se ghoomta/scale hota hai aur
   screen se bahar chala jata hai. Ye line har animated shape par lagao (ya `transform-origin` px mein do).
2. **`animation-fill-mode: both` na dena** — delayed items apne time se pehle bhi dikhte hain,
   is liye “baari baari” wala effect khatam ho jata hai.
3. **Text ki width par bharosa** — GitHub fonts download nahi karta. Pill / button ka background
   text se **hisab** se banao (monospace: `len × size × 0.6 + padding`) ya `text-anchor="middle"` laga kar
   center se position karo.

### Accessibility: reduced motion (har file mein hona chahiye)

```css
@media (prefers-reduced-motion: reduce){
  .ch,.caret,.spin,.ring,.bar,.tape,.fade{animation:none!important}
  .ch,.fade{opacity:1}
}
```

Jo user “reduce motion” on karta hai usay poora static banner milta hai — animation ki jagah
khaali/adhoora frame **nahi**.

---

## 2. Tayyar services (ek line mein animation)

| Service | URL pattern | Kya deta hai |
| --- | --- | --- |
| readme-typing-svg | `https://readme-typing-svg.demolab.com?lines=Hello;World&font=Fira+Code&color=0B6B45` | typing / deleting text SVG |
| capsule-render | `https://capsule-render.vercel.app/api?type=waving&color=0B6B45&text=MIZANORA&animation=fadeIn` | wave / gradient header banner |
| github-readme-stats | `https://github-readme-stats.vercel.app/api?username=muaaziqbalvip&show_icons=true` | stats card (live) |
| github-readme-streak-stats | `https://streak-stats.demolab.com?user=muaaziqbalvip` | streak card |
| shields.io | `https://img.shields.io/github/stars/u/r?style=flat-square` | badges (static-ish, always live) |
| Platane/snk | GitHub Action → `snake.svg` | contribution snake |
| readme-SVG typing generator | `https://readme-svg-typing-generator.vercel.app/api?lines=...` | 20 animation styles |
| readme-terminal (ExplorerOf) | Action → `terminal.svg` | terminal jo commands type karta hai |

**Rule:** ye sab **teesri site** par depend karte hain. Profile README ke liye theek,
shop ke repo ke liye hum self-hosted SVG rakhte hain.

---

## 3. GitHub Action se roz taaza data (asli “live”)

Agar aapko **asli numbers** (contributions, stars, commits) roz animation mein chahiye:

```yaml
name: readme-art
on:
  schedule: [{ cron: '17 6 * * *' }]   # roz 06:17 UTC
  workflow_dispatch: {}
  push: { branches: [main], paths: ['scripts/make-readme-art.mjs'] }
permissions:
  contents: write
jobs:
  art:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: node scripts/make-readme-art.mjs
      - run: |
          git config user.name  "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add public/brand/readme
          git diff --cached --quiet || git commit -m "chore: refresh readme art"
          git push
```

Isi tarah contribution graph scrape karke heatmap SVG banti hai (bina token, sirf public page).

---

## 4. MIZANORA ka art kaise badlein

```bash
# 1. art source kholo
code scripts/make-readme-art.mjs
```

Andar teen jagah kaafi hain:

| Kya badalna hai | Kahan |
| --- | --- |
| colours | `const C = { deep, forest, emerald, mint, gold, … }` |
| banner ka text / typing line | `hero()` ke andar `typedLine({ text: … })` |
| tape ke words | `tapeGroup({ items: ['SHOP SMART', …] })` |
| LIVE bar ke titles | `live()` ke andar `fade1 / fade2 / fade3` texts |
| speed | har `animation-duration` (script ke `<style>` block mein) |

```bash
# 2. dobara generate
node scripts/make-readme-art.mjs

# 3. commit
git add public/brand/readme && git commit -m "art: new banner" && git push
```

**Cache:** GitHub image ~5 minute cache karta hai. Turant chahiye to README mein
`hero.svg?v=2` likh kar number barha do.

---

## 5. Checklist (naya animated README banane se pehle)

- [ ] SVG ka `viewBox` set hai (aur `width`/`height` bhi — purane renderers ke liye)
- [ ] har animated shape par `transform-box: fill-box` + `transform-origin`
- [ ] delayed items par `animation-fill-mode: both`
- [ ] text monospace ya `text-anchor="middle"` se position hua
- [ ] `@media (prefers-reduced-motion: reduce)` block maujood
- [ ] koi `<script>` nahi, koi external font nahi
- [ ] text chhota aur asli (search engines + screen readers ke liye `aria-label` / `<title>`)
- [ ] file 100 kB se kam (GitHub jaldi load kare)
- [ ] README mein relative path sahi (`public/brand/readme/hero.svg`)
- [ ] SVG ko browser tab mein khol kar check kiya (Preview app mein animation nahi chalti)
