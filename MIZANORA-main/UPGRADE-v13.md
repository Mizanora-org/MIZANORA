# Mizanora v13 — Zero-Firebase shop + real AI voice assistant + taste memory + new blogs/SEO

This upgrade follows your idea exactly: **products are NOT saved in Firestore any more.** The shop runs from the
JSON files in `data/catalog` (what the CSV import writes / GitHub commits). Firestore stays only for orders,
accounts and the admin panel — so the "reads limit finished" problem cannot stop your shop.

Everything below was checked with `node scripts/check.js` (240 files, 0 problems), `node scripts/typecheck.js`
(clean) and a real `next build` + production server smoke test. The zero-Firebase path was tested live with a
12-product archive and **no Firebase env at all**: home page, product pages, search, browse, sitemap, feeds and
"aap ke liye" shelf all worked.

---

## 1. What is new

### A. THE WHOLE CATALOGUE, FROM FILES (zero Firestore reads for products)
* **`lib/products.js` → `getShopAll()`** (new): live products + **archived products** (from `data/catalog`) in one list.
  A live product always wins over its archive copy (that is how "Restore to Firebase" edits apply).
* **Home page** (`app/page.js`) now builds every shelf from `getShopAll()` — the budget shelf, picks, fresh arrivals and
  the 8 category shelves can show archived/CSV products too. **Saari products ab home par show hoti hain.**
* `HOME_WINDOW` env (optional, default `4000`): how many of the newest archive products take part in the home page.
  Set `HOME_WINDOW=12000` if you want even more on the home page (it is all in-memory, still 0 Firestore reads).
* **Hidden products**: a product you hide in the panel gets `active:false` → it is skipped everywhere
  (home, shop pages, search, browse, feeds, sitemap, assistant).

### B. Admin > Catalogue (files) — edit the shop without Firestore
* **`app/admin/catalogue/page.js`** + **`app/api/admin/archive-edit/route.js`** (new).
* Search the whole catalogue (all parts, server side, zero Firestore reads), open a product and edit
  **name, price, old price, categories, description, photos, in stock, featured, visible**.
  Save = one small new part file committed to your repository. The archive reader always takes the NEWEST part,
  so your edit wins after the Vercel deploy (1–3 minutes). **Zero Firestore writes.**
* One-tap actions per product: **Sold out / In stock**, **Hide / Show**, **Feature / Unfeature**.
* **"To Firebase"** is the only button that writes to Firestore — use it only when you want the old
  Admin > Products form (or a promo code) for one specific product.
* Archive writes need `GITHUB_TOKEN` + `GITHUB_REPO` (Contents: Read and write). Reading/search still works without them.

### C. Import CSV defaults to the files (no Firebase)
* In **Admin > Import CSV**, when GitHub is connected the selected mode is now
  **"Save to my repository (no Firebase) — recommended"**, and the buttons at the bottom show the honest cost
  (`0 Firebase writes` in archive mode vs "about N Firebase writes" in Firebase mode).
* Small CSVs (under 2,000 products) also go to the files by default when GitHub is connected — Firebase mode stays
  available for the few products you want to edit in the old form.

### D. Assistant — fed from this catalogue, remembers what the shopper likes
* **`lib/aiPrefs.js`** (new): taste memory in the Realtime Database (`aiPrefs/<device>`), written **only** as category
  counters — no name, phone or account. The browser makes up `mz_did` (localStorage) and sends it with each message.
* She **learns from what you type and from what she shows you**, and her searches now start with the categories you
  like (`runSearch(a, liked)`), and her system prompt carries a "THIS SHOPPER'S TASTE" line.
* **"Aap ke liye" shelf on the home page** — **`components/ForYouShelf.js`** + **`app/api/for-you/route.js`** (new):
  shows products from your liked categories, read from the archive files (`Cache-Control: max-age=300`),
  **zero Firestore reads**, and it disappears when there is no taste yet.
* Every assistant reply now returns `prefs` → the browser also mirrors them into `localStorage mz_ai_prefs`
  (so the shelf is instant on the next visit).

### E. Real AI voice + only-voice experience
* `DEFAULT_CFG.voiceMode` is now **`'gemini'`** — the assistant speaks with real AI voice (Google Gemini TTS).
* **`TTS_MODELS`** ladder in `lib/gemini.js`: `gemini-2.5-flash-preview-tts` → `gemini-2.0-flash-preview-tts`;
  the TTS route tries both, and the browser voice stays as the last fallback (so awaz kabhi band nahi hoti).
* **Barge-in**: tapping the mic while she is talking stops her instantly — you can talk over her like a real assistant.
* Chat models: the auto-switching ladder now also includes the `gemini-2.0-flash` family, so when a free limit
  finishes on one model/key she moves to the next one automatically.

### F. Deal link
* Assistant deal cards now have a **WhatsApp share button**: one tap sends
  `Name — Rs <new price> (Rs <off> off)` + the product link to any chat.

### G. New blogs + best SEO + Google/Meta products link
* **6 new blog posts** (33 total): `sasti-online-shopping-pakistan-tips`, `sardi-winter-shopping-checklist-pakistan`,
  `mobile-accessories-buying-guide-pakistan`, `kitchen-home-items-kharidne-ki-guide`,
  `tuhfe-gift-dene-ke-liye-online-ideas`, `mizanora-sasti-aur-honest-prices-kaise`.
  They are linked from the blog index, the home page and `sitemap.xml` automatically.
* **Google Merchant feed** (`/api/feed/google`) now always includes the archived products (slim cards: name, price,
  sale price, photo, availability, category, shipping). `?live=1` = live products only. Add it in
  Merchant Center → Products → Feeds → `https://<your-domain>/api/feed/google`.
* **Meta catalog feed** (`/api/feed`) and the **AI/agent catalogue** (`/catalog.json`) now include the archived
  products too (a zero-Firebase shop still reaches Meta shops, catalog ads and AI shopping assistants).
* `sitemap.xml` already lists archived products (up to 49,000 URLs) — new blogs are in it as well.

---

## 2. Quick start (5 minutes)

1. **Deploy** this folder to your Vercel project (as usual), and make sure these are in Vercel → Settings → Environment Variables:
   * `GITHUB_TOKEN` (fine-grained, this repository, **Contents: Read and write**) and `GITHUB_REPO` (`owner/repo`)
     → needed to save/edit products in the files.
   * `FIREBASE_DATABASE_URL` (Realtime Database) → needed for the taste memory + voice counters.
   * Your existing Firebase web keys (orders keep working exactly as before).
2. **Import your CSV**: Admin → **Import CSV** → upload → mode **"Save to my repository (no Firebase)"** → Import.
   Wait 1–3 minutes for the Vercel deploy, then open your home page: **saari products aa jayengi** (0 Firestore writes).
3. **Try the panel**: Admin → **Catalogue (files)** → search a product → Edit price → Save.
   One commit, one deploy, zero Firebase.
4. **Talk to the assistant**: open her, say "mujhe shoes pasand hain" / "kurti dikhao". She shows products with real voice.
   Next time you open the home page, the **"Aap ke liye"** shelf shows more of what you liked.
5. **Feeds**: /api/feed/google in Google Merchant Center, /api/feed in Meta Commerce Manager.

### Checklist after deploy
- [ ] Home page shows your CSV/archived products (no Firebase import needed).
- [ ] Admin → Catalogue (files) search shows parts and a part number.
- [ ] Edit one price → after the deploy the shop shows the new price.
- [ ] Assistant speaks (real voice) and stops when you tap the mic.
- [ ] Home shows "Aap ke liye" after one assistant chat.
- [ ] /api/feed/google lists your products (open it in a tab).

---

## 3. Files in this upgrade

**New:** `lib/aiPrefs.js`, `components/ForYouShelf.js`, `app/api/for-you/route.js`,
`app/api/admin/archive-edit/route.js`, `app/admin/catalogue/page.js`, `lib/archiveBuild.js`,
6 files in `content/blog/`, this file.

**Edited:** `lib/products.js` (`getShopAll`, `HOME_WINDOW`), `app/page.js`, `lib/archive.js` + `lib/archiveFormat.js`
(hidden flag `x`), `lib/gemini.js` (voiceMode `gemini`, `TTS_MODELS`, model ladder), `app/api/assistant/route.js`,
`app/api/assistant/tts/route.js`, `components/AssistantPanel.js`, `app/api/feed/route.js`,
`app/api/feed/google/route.js`, `app/catalog.json/route.js`, `app/admin/import/page.js`,
`components/AdminNav.js`, `scripts/…` unchanged, `package.json` → `13.0.0`.

## 4. Honest notes
* Every file-edit goes through a commit + Vercel deploy, so it is live in **1–3 minutes**, not instantly.
  Firestore-mode edits are instant (as before).
* The archive is served from memory (no Firestore reads) — the first request after a deploy reads the files once.
* Real AI voice needs a Gemini API key that supports TTS (your assistant keys do). If a voice model is busy,
  she automatically falls back to the next model, then to the browser voice — the assistant is never silent.
* Nothing in this upgrade changes order/checkout behaviour.
