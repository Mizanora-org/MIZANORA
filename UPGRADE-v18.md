# Mizanora v18.0.0 — kya naya hai

v17 ke upar ye kaam hue hain: **app ka background music ab poori app mein chalta hai** (admin panel se MP3 link set karo), **search bohat behtar** hua (keyboard se chal jata hai, rang sahi filter karta hai, words highlight hote hain), **menu aur layout ke bugs** theek hue hain, aur shop **premium** lagti hai.

---

## 1. App ka background music (admin se set hota hai)

- **Admin panel → Music** (naya page) mein **"App background music"** card hai.
- Wahan ek **direct audio link** paste karein (`.mp3`, `.m4a`, `.ogg`, `.wav` par khatam hona chahiye). Save karne ke baad link `siteMeta/appMusic` Firestore doc mein jaata hai aur site ka cache turant refresh hota hai.
- Ab **poori app** — home, products, category, cart, blog — us music ko dheere dheere background mein chala rahi hai.
- Header mein ek **music button** aa gaya hai:
  - Note ki icon + halki si "saans" (ring) = music chal raha hai.
  - Note ki icon bina ring = music on hai, browser pehli tap ka intezaar kar raha hai.
  - Cross note = shopper ne band kar diya.
- Shopper ka choice uske phone mein save hota hai (`mz_app_music`), dobara aane par wahi rehta hai.
- Admin ke paas 4 options hain: **music on/off**, **khud ba khud shuru ho (autoplay)**, **volume (0-100%)** aur **music ka naam**.
- Browser ka rule: sound pehli tap se pehle nahi chalta, is liye music pehli touch ke baad shuru hota hai.
- Admin panel mein **Test play** button se pehle sun sakte hain. **Remove link** se music band ho jaati hai.
- Google Drive aur Dropbox share link khud-ba-khud direct link mein badal jaate hain (jahan possible ho).

### Reels ka music bhi wahi page par

- **Admin → Music** par doosra card **"Reels background music"** hai (pehle ye Admin → Reels mein tha). Woh ab bhi wahi kaam karta hai: sirf un reels ke peeche chalta hai jin ki apni awaaz nahi hai.
- Admin → Reels par ab chhota sa message hai ke music Admin → Music se set hota hai (do jagah alag-alag form nahi, ek hi jagah).

### Background music aur reels ka music aapas mein

- Reels full-screen khulte hi app ka background music **ruk jaata hai** (reels ki apni music chalti hai). Reels band karne par background music wapas shuru ho jaata hai.
- Dono ka apna apna volume aur apna apna link hai. Koi doosre ko nahi badalta.

**Limits:** Link khud ek direct audio file honi chahiye. Cloudinary audio upload support karta hai, ImgBB nahi. Browser ka codec support decide karta hai ke file chalegi ya nahi — is liye **Test play** zaroor karein.

---

## 2. Search bohat behtar

### Naye controls (header wale search box mein)

- **Keyboard se chal jata hai:** `↑` aur `↓` se suggestions par jayein, `Enter` se khul jayein, `Esc` se band ho jaye.
- Jo **word aap ne likha**, us product ke naam mein **highlight** ho kar dikhta hai.
- Search ke mutabiq **category** bhi apni row mein aa jati hai (jaise "suit" likhne par "Women Fashion" shelf).
- Panel ke neeche **kitne results** hain, wo bhi likha hota hai.
- Ek chhota **(X)** button poora box ek tap mein khaali kar deta hai.
- Panel ab **scroll** hota hai — chhoti screen par pehle results kat kar reh jate the aur un tak pohanch na sakte the.

### Search ki quality

- **Rang ab sach mein filter karta hai.** Pehle "black joota" likhne par blue shoes bhi aa jate thay. Ab jo product ke paas rang hai wohi aata hai.
- **Zyada nahi, sahi results.** Ek typo sirf sahi product tak pohanchta hai, har synonym tak nahi.
- **"Did you mean"** ab behtar hai: "leather jota" likhne par "leather joota" suggest hota hai.
- Urdu/Roman Urdu words, rang, price limit ("under 2k"), "sasta / premium" — sab pehle ki tarah chalta hai, bas duplicate words hat gaye hain.

### /products page

- Upar **"12 products for 'laal suit'"** jaisa line aata hai, aur saath mein ek **(X)** jo search mita deta hai.
- Jab kuch na mile to sirf "No products found" nahi: **aap jaise hi likh rahe hain** wo likha hota hai, **"Did you mean"** aata hai, assistant se poochne ka button hai, aur **shelves ke buttons** diye jate hain (kisi aur shelf par bhi jaa sakte hain).
- Badi shop mein products aate waqt ab **skeleton cards** dikhte hain (ek line text nahi), is liye page hilta nahi.

---

## 3. Menu aur layout ke bugs theek hue

- **Mobile menu ab atak nahi hota.** Pehle ye sirf link dabane par band hota tha. Ab ye:
  - menu ke **bahar tap** karne par band hoti hai,
  - **Esc** dabane par band hoti hai,
  - **page change** hone par khud band ho jati hai.
- Menu khulne par **peeche ka page scroll nahi hota**.
- Menu **dheere se neeche aati hai** (animation), pehle achanak aa jati thi.
- Menu ke peeche **dim layer** aata hai. Yeh layer header se **bahar** rakhi gayi hai, kyun ke header mein blur hai aur blur wale box ke andar "fixed" element viewport ke hisaab se nahi lagta (pehle layer galat jagah lag rahi thi).
- **Category bar** ab dikhata hai ke aap kis category par hain.
- **Bottom bar**: "Shop" tab ab category aur product page par bhi chamakta hai; cart ka number pehle icon ke **beech** mein lagta tha, ab icon ke **kone** par sahi jagah hai; active tab par halki pill aati hai.
- **Anchor links** ab sticky header ke neeche chhupte nahi (heading dikhti hai).

---

## 4. Premium look aur animations

- **Header** ab halka sa glass hai (blur + thoda transparent) aur page scroll karne par uska shadow gehra hota hai.
- **Product cards** par hover karne par **gold hairline** aati hai, shadow gehra hota hai aur photo thoda zoom hoti hai.
- **Discount badge** ab gradient hai, plain red nahi.
- **Loading** mein skeleton cards (shimmer) — pehle sirf "Loading..." likha hota tha.
- **Music button** chalne par halki "saans" ki ring aati hai.
- **Mobile menu** neeche slide hoti hai.
- Tez phones par sab halka hai: koi blur nahi, koi gradient animation nahi, sirf opacity aur transform.
- Sab kuch **"reduce motion"** wale logon ke liye apne aap band ho jata hai.

---

## 5. Tools aur checks (developer ke liye)

- `npm run check` — syntax + import + undefined names (ek saath).
- `npm test` — ab 5 suites chalti hain: import, voice, music, **app music** (naya) aur **search** (naya).
- `npm run build:offline` — **bina internet ke build**. `next/font` build ke waqt Google Fonts se fonts laata hai; agar wahan internet na ho to build fail ho jata tha. Naye mock (`scripts/google-fonts-mock.js`) se build ab offline chal jata hai (sirf check karne ke liye; asli deploy par normal `npm run build` chalayein taake asli fonts lagay).
- `typescript` ab **5.x** par pin hai (devDependencies). TypeScript 7 ne `ts.JsxEmit` hata diya tha, jis se `scripts/check.js` aur `scripts/typecheck.js` dono crash ho jate the.

---

## 6. Files

| File | Kaam |
|---|---|
| `lib/audioLink.js` | **Naya.** Link check / convert ka ek hi jagah wala code (dono music features istemal karte hain). |
| `lib/appMusic.js` | **Naya.** App background music ke settings aur rules. |
| `lib/appMusicServer.js` | **Naya.** Server se music padhna (cache ke saath, tag `app-music`). |
| `components/AppMusic.js` | **Naya.** Poori app ka music player (loop, autoplay, reels ke saath coordination). |
| `components/MusicToggle.js` | **Naya.** Header ka music button. |
| `components/MusicCards.js` | **Naya.** Admin ke dono music cards (app + reels) ek jagah. |
| `app/admin/music/page.js` | **Naya.** Admin → Music page. |
| `app/layout.js` | Music server se padhta hai aur player + header button ko deta hai. |
| `components/Header.js` | Menu ke bugs theek, glass header, music button, active category. |
| `components/BottomNav.js` | Cart badge theek, active pill, zyada tabs sahi chamakte hain. |
| `components/SearchBox.js` | Keyboard, highlighting, category row, count, clear button, scroll. |
| `components/ProductGrid.js` | "for 'xyz'" line, skeleton cards, behtar empty state. |
| `lib/search.js` | Rang ka asli filter, duplicate words hataye. |
| `app/globals.css` | Naye animations, gold hairline, anchor offset. |

---

## Verify karne ke liye (deploy ke baad)

1. **Admin → Music** mein MP3 link paste karke **Test play** karein, phir **Save music**.
2. Phone par app kholein: header mein music button aana chahiye. Phone par kahin bhi tap karein, music chalna chahiye.
3. Music button daba kar band karein; page reload karein — band hi rehna chahiye (shopper ki choice yaad rahti hai).
4. Search box mein `↑`/`↓` se suggestions chunein, `Enter` daba kar kholein.
5. `black joota` likhein: sirf joote aayein, blue shoes nahi.
6. Mobile menu kholein, phir bahar tap karein — menu band ho jana chahiye.

## Test kya nahi hua

- Real mic, Firebase, Gemini, aur Vercel deploy is sandbox mein test nahi ho sake.
- Browser mein music, animations aur keyboard navigation ka behaviour manually verify nahi hua (sandbox mein Chromium launch nahi hota).
- Build, check, typecheck, tests aur route curl checks pass hue hain.
