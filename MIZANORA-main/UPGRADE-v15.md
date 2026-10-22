# Mizanora v15 — FINAL: video links, purane products safe, saari videos reels me, mic + PWA

Ye upgrade aap ki do asal shikayaton par bana hai: **(1) purane products show nahi ho rahe the**, aur **(2) CSV me jo
links load nahi ho rahi thin wo asal me VIDEO links thin.** Dono ki jarh pakri gayi aur theek kar di gayi. Sath me:
assistant ka mic/pemission flow, hands-free voice, aur PWA install (best).

Test: `node scripts/check.js` → **251 files, 0 problems** · `typecheck` clean · `next build` → 90 pages ·
production server par 6-product archive se test: photo wala, **YouTube link (images column me)**, **mp4**, **Facebook reel**,
media nahi wala, aur hidden wala — sab expected behave kiya. Phir **manifest.json delete kar ke** bhi test kiya:
products phir bhi live rahe (self-healing).

---

## 1. Purane products kyun gayab hue the (asal wajah) — aur ab kabhi nahi honge

Do cheezein thi, dono theek:

**(a) Video link = "image" samjhi gayi thi.** CSV ki `images` column me Facebook / Instagram / TikTok / YouTube / `.mp4`
link ho to shop usay **photo** samajh kar dikhane ki koshish karta tha → photo load nahi hoti thi → (v14 me) card
hat jata tha aur product "gayab" lagta tha. Ab **`lib/media.js`** ek hi jagah faisla karta hai: video link **kabhi**
image nahi banta:
* **YouTube** link se **asli thumbnail photo** ban jati hai → product card par poori tasveer (aur video alag se).
* **.mp4 / .webm / .mov** → card par pehla frame (asli video) + play badge.
* **Facebook / Instagram / TikTok reel** → khoobsurat play-cover + "Facebook video" label (blank grey box kabhi nahi).
* Ye repair **read-time** par hai, is liye aap ki **mojooda 50,000-product catalogue (GitHub me, purane cards me)
  khud theek ho jati hai** — dobara import karne ki zaroorat nahi.

**(b) Upgrade ka `manifest.json`.** v14 zip ke andar `data/catalog/manifest.json` (khali) tha. Wo GitHub par upload hone
se parts ki list reset ho jati hai → products files me hote hue bhi shop par nahi dikhte. Ab **teen** hifazat:
1. Zip me `data/catalog/` **bilkul shamil nahi** — upload karte waqt aap ki files chhui bhi nahi jayengi.
2. **Server self-heal**: manifest khali/ghayab ho to shop khud folder scan kar ke parts rebuild kar leti hai
   (`archive manifest was empty: rebuilt from N part file(s)` server log me).
3. **GitHub self-heal**: Admin/Catalogue jab repo se parts list parhta hai aur manifest khali ho, to wo bhi
   repository ki files se list dobara bana leta hai.

> Sab kuch **additive** hai: import/upgrade sirf naye files add karta hai ("base_tree" commit), purane products
> delete nahi hota. Aur v14 ka **Price lock** bhi barqarar: dobara CSV upload karne par purane products ka price nahi badalta.

## 2. Saari videos catalogue ke sath SHORT REEL FEED me

* **Reels feed ab aap ki catalogue se bhi bharti hai** (`getReels` → `archiveRecentDocs` + live products).
  CSV ki video column (ya jo video images column me tha) wali **har product** reels rail me aa jati hai —
  YouTube, mp4, Facebook/Instagram/TikTok reel, sab.
* Reels rail home page par bhi hai aur `/reels` par (swipe feed, "Shop now" button ke sath — direct product page).
* Naye archive parts me card ke sath **pehli video bhi save hoti hai** (`v` field), is liye bade catalogue me bhi
  reels load tez rehta hai. Purane parts ke liye server newest 6 parts padh kar videos nikalta hai
  (`REEL_PARTS` env se badla ja sakta hai, default 6).
* Sirf video wale products bhi ab **shop par show hote hain** (video card ke sath) — pehle wo "no photo" keh kar
  skip ho jate the.

## 3. AI Voice Assistant — mic + voice-only upgrade

* **`lib/mic.js`** (naya): pehle **asli permission** mangwai jati hai (`getUserMedia`) — isi se browser ka
  *Allow* popup pehli tap par aata hai; phir recogniser chalta hai. Permission state (granted / band / poochhna hai)
  har dafa panel kholne par check hoti hai.
* **Header me mic status bar**: 🟢 *Mic ready* · 🟠 *Mic permission chahiye* · 🔴 *Mic band hai - theek karein*, aur
  **hands-free ON/OFF** switch (aap ka choice localStorage me yaad rehta hai).
* **Hands-free** ON ho to wo har jawab ke baad **khud sun leti hai** (asli voice assistant jaisa), aur agar kuch sunai
  na de to dobara khud sunna shuru kar deti hai.
* **Na milne par aam madad** (roman Urdu me exact steps): adhooray se phone settings tak, in-app browser (Facebook/Instagram)
  ka masla, mic busy, mic nahi mila — aur "Try again" button.
* **Har voice error ka apna paigham** (JavaScript ka "no-speech / audio-capture" wagera nahi): "Awaz nahi aayi, dobara
  boliye", "Microphone kisi doosre app ne pakra hua hai" wagera.
* Chhoti si **dancing-wave animation** jab wo sun rahi ho, aur assistant ke cards me video product par **play badge**.
* Barge-in aur multi-model auto-switch (v13) barqarar hain.

## 4. PWA — poori app jaisi install

* **`app/manifest.js`**: `display_override`, `launch_handler` (existing tab use karega), `handle_links`,
  `dir`, `categories`, aur **5 shortcuts** (Shop, Cart, Reels, Track order, Earn) — long-press app icon par seedha ye screens.
* **`public/sw.js` v3**: ab **har visit kiya gaya page offline padhne ke liye cache** hota hai (pehle sirf home),
  `/api` aur `/admin` ko kabhi touch nahi karta, icons + manifest precache.
* **Auto-update**: naya deploy aate hi naya service worker activate hota hai aur app **khud reload** hoti hai
  (reload sirf tab jab tab visible ho). Har 30 minute update check.
* **Install entry** footer aur account page par (`components/InstallApp.js`): Android/Chrome par asli install button,
  iPhone par 2-tap tareeqa (Share → Add to Home Screen).
* Splash + ring loader barqarar; animations `prefers-reduced-motion` ka khayal rakhti hain.

## 5. Naye files / badle hue files

**Naye:** `lib/media.js`, `lib/mic.js`, `components/CardMedia.js`, `components/InstallApp.js`, `README-UPLOAD.md` (is file ke sath), `UPGRADE-v15.md`.
**Hataya:** `components/CardPhoto.js` (kaam `CardMedia` kar leta hai).
**Bade tabdeel:** `lib/archive.js` (self-heal + media split + recent docs), `lib/archiveBuild.js` (repo self-heal),
`lib/archiveFormat.js` (card me `v`, cleanDoc split), `lib/products.js` (shape + reels + shelves), `lib/catalogQuery.js`,
`lib/importProducts.js` (video column + split), `app/admin/import/page.js` (video products skip nahi hote),
`app/api/admin/archive-edit/route.js`, `components/AssistantPanel.js`, `components/PwaRegister.js`, `app/manifest.js`,
`public/sw.js`, `app/globals.css`, `components/ProductCard.js`, `components/Footer.js`, `components/AccountClient.js`,
`app/api/assistant/route.js`, `app/api/for-you/route.js`, `package.json` → **15.0.0**.

## 6. Upload karne ka tareeqa (IMPORTANT — products safe rahenge)

1. Zip ko apne computer par **extract** karein.
2. GitHub par apne repo me jaayein → **Add file → Upload files** → extract ki hui files/folders **drag** karein
   (poora folder `MIZANORA` nahi, uske **andar ki cheezein**: `app`, `components`, `lib`, `public`, …).
3. Commit karein. **`data/catalog/` ka koi file zip me nahi hai**, is liye aap ke products ki files aur
   `manifest.json` waise hi rahenge — kuch bhi delete nahi hoga.
4. Vercel khud deploy kar dega. Deploy ke baad:
   - Home par purane + naye products dono dikhne chahiye.
   - Jis product ka link video tha, ab us par **asli thumbnail / video card** dikhega.
   - `/reels` par **saari catalog videos** aa jayengi.
   - Assistant khol kar mic button dabayein → **Allow** → boliye "kurti dikhao" (hands-free ON rakh kar lagatar baat karein).
   - Phone par browser menu → **Install app** (ya iPhone: Share → Add to Home Screen).

**Kabhi na karein:** `data/catalog` folder ko delete/replace karna, ya GitHub ka "delete all files" wala tareeqa.
Agar ghalti se manifest khali ho jaye to bhi ghabrayein nahi — shop khud rebuild kar leti hai (self-heal).

## 7. Checklist after deploy
- [ ] Purane products (jo pehle gayab the) wapas show ho rahe hain.
- [ ] Video-link wale products par thumbnail/video card dikh raha hai (blank nahi).
- [ ] `/reels` par catalog ki saari videos mojood hain.
- [ ] Dobara CSV upload karne par purane prices nahi badle (price lock).
- [ ] Assistant: mic Allow popup, status bar, hands-free ON, help card (band hone par).
- [ ] PWA install ka button + app icon shortcuts kaam kar rahe hain.
