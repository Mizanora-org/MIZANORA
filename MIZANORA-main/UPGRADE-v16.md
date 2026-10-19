# Mizanora v16: Voice assistant, Reels shuffle, CSV import fix, mic permission fix

Yeh upgrade teen asal shikayaton par bana hai: **(1) assistant sirf chat karti thi aur mic chalta nahi tha**,
**(2) CSV se size / colour / price / stock ghalat ya gayab aata tha**, **(3) reels ka alag button nahi tha**.
Saath mein kuch screen glitches aur polish bhi theek kiye gaye hain.

---

## 1. Mic kyun nahi chal raha tha (asal wajah) - ab theek

**`next.config.js` mein `Permissions-Policy: microphone=()`** tha. Iska matlab tha ke poori site par mic
**permanently block** thi, chahe browser permission de dein. Ab: `microphone=(self)` - sirf Mizanora ke apne
pages mic maang sakte hain. Doosri websites jo embed hain phir bhi mic nahi le sakti.

> Deploy ke baad phone par site ko ek dafa **refresh** karein, aur agar pehle "Block" kiya tha to address bar ke
> lock icon se Microphone ko **Allow** karein.

## 2. AI Assistant ab asli voice assistant hai

| Pehle | Ab |
|---|---|
| Har jawab ke baad mic dobara maangta/atakta tha | Permission ek dafa milti hai, phir hands-free conversation khud chalti hai |
| Chrome ka 15 second wala bug: lamba jawab beech mein ruk jata tha aur mic kabhi wapas nahi aata tha | Jawab chhote tukdon (150 characters) mein bola jata hai |
| Android par pause/resume se awaaz cancel ho jati thi (research se pata chala) | Keep-alive sirf desktop par; Android par sirf chhote tukde |
| Stale closures: `send` aur `startListen` purani values use karte the | Sab voice logic `ref`s par, koi purani value nahi |
| Voices late load hoti thi, galat awaaz | `voiceschanged` sunti hai, female voice chunti hai |
| Kuch na sunai dene par bhi lagatar sunti rehti thi | 3 khali turns ke baad ruk kar button dabane ko kehti hai |
| Mic band karne ke baad bhi awaaz chalti rehti thi | Panel band karte hi speech, timer aur mic sab band |

**Naye features**
* **Language selector** (panel ki status bar mein): *Roman Urdu / English* (en-IN, Roman Urdu/Hinglish ke liye behtar) ya *اردو*.
* **Status line** header mein: *Sun rahi hoon... / Soch rahi hoon... / Bol rahi hoon...*
* Bolne par **live transcript** input mein dikhta hai; mic dabane par jo suna wo turant bhej deti hai.
* Bolte waqt mic dabane se **barge-in**: wo rukti hai aur sunne lagti hai.
* Panel kholne par agar mic pehle se allowed hai aur hands-free ON hai, to greeting ke baad khud sunna shuru.

## 3. Reels: bottom menu mein naya button + random reels

* Bottom bar mein **Reels** tab (Clapperboard icon). Tap karne par reels **random order** mein khulti hain.
* `/reels` page par **"Naye random reels"** button: ek tap par saari reels dobara mix.
* Bottom bar par Reels tab dobara tap karne par bhi reels reshuffle hoti hain.
* Home page wali reels rail wahi purani tarteeb mein rehti hai.

## 4. CSV import: size, colour, price, stock, photos, description - ab sahi

Ye sab `lib/importProducts.js` mein theek kiya gaya. Tests `scripts/test-import.mjs` mein hain (22 tests, sab pass).

| Masla | Wajah (pehle) | Ab |
|---|---|---|
| Sirf 1 size aata tha | Ek product ki sirf pehli variant row padhi jati thi | **Har variant row** padhi jati hai; saari sizes aur colours unique order mein |
| Blank Handle wali variant rows gum | Export mein Handle sirf pehli row par hota tha | Khali Handle wali row usi upar wale product se judti hai |
| Option2 (Colour) gayab | Sirf Option1 padha jata tha | Option1, Option2, Option3 teeno padhe jate hain |
| "Size - Red" ek hi option mein | Galat split | Size aur Color mein alag hota hai |
| Sizes ulte/bikhre (38, 40, 39) | Order sheet ke mutabiq | Numeric sizes chhote se bade tak |
| Price "1,250" ya "Rs 1,250" aane par product skip | `Number()` NaN deta tha, product chupchap chhod diya jata tha | `num()` comma/Rs khud hata deta hai |
| Variant prices alag alag, ek sasta size pe loss | Sirf pehli row ki price | **Sab se zyada supplier price** lee jati hai (loss nahi hota), aur preview mein warning |
| Stock hamesha "in stock" | Inventory column padha hi nahi jata tha | Agar sheet mein inventory hai aur sab 0 hai to "out of stock" + warning |
| Column ka naam "Name" ya "PRICE" ho to detect fail | Exact naam chahiye tha | Capital, space, `_`, bracket sab ignore |
| HTML entities (&#8217; &#x27;) adhoori | Chand hi decode hote the | Sab entities decode |
| `<br>` ya plain text description ghayab | Sirf `<p>` padha jata tha | Plain text aur `<br>` bhi padhi jati hai |
| Quote ke beech ka `"` poori line kha jata | Parser har quote ko quoted samajhta tha | Quote sirf cell ki shuruaat par |
| Title ke andar naya line break | Title mein newline reh jata tha | Single line mein saaf |

## 5. Screen glitches aur polish

* **Floating buttons ka overlap:** Back-to-top aur Assistant button ek dusre ke upar aate the (mobile aur desktop dono). Ab neeche se sahi stack: WhatsApp → Assistant → Back to top.
* **Bottom bar:** 6 tabs, behtar spacing, cart ka badge sahi jagah par.
* **Reels header:** buttons wrap hote hain (chhote phone par overflow nahi).

## 6. Tests

```
npm test
```
* `scripts/test-import.mjs`: 22 tests (CSV, variants, prices, stock, photos, descriptions, round trip). **Sab pass.**
* `scripts/test-voice.mjs`: 4 tests (jawab ko tukdon mein todna, Urdu/English punctuation). **Sab pass.**
* `node scripts/check.js` (syntax + imports) - **252 files, 0 problems**.
* `node scripts/typecheck.js` - **clean**.
* `next build` - **pass**.
* Production server par saare main routes (`/`, `/reels`, `/products`, `/cart`, `/checkout`, `/account`, `/track`, `/workers`, `/admin`, product aur category pages) **HTTP 200**. `/reels` par naya button aur Reels tab render hote hain.

## 7. Deploy karne ke steps

1. Zip se files nikalein (ya `MIZANORA` repo ke upar overwrite karein; `data/catalog/` ko na chhedein).
2. `npm install` phir `npm test` (optional) phir `npm run build`.
3. GitHub par push karein; Vercel khud deploy karega.
4. Phone par site kholen, mic button dabayein, **Allow** karein.

## 8. Abhi kya check karna zaroori hai (mein device par live mic test nahi kar saki)

* **Mic:** Android Chrome, iPhone Safari, aur Facebook/Instagram in-app browser (in-app browser mein mic aksar nahi chalta; "Open in Chrome" ka message dikhaya jata hai).
* **Gemini voice** (admin > Assistant > "Gemini voice") agar on hai to network se awaaz banegi; fail hone par browser ki awaaz chalegi.
* **Firebase / Gemini keys:** ye sirf live server par hi chalte hain; local test mein inka data nahi tha.
* **Asal CSV:** apni asli Markaz CSV se ek chhota sample import karke admin preview mein sizes dekh lein (preview mein har product par `variants` aur warnings dikhte hain).

## 9. Abhi ki limits (honest)

* Speech recognition browser ki service par chalti hai (Google). Offline nahi chalti.
* iPhone Safari par mic sirf tap se shuru hota hai (Apple ki policy); hands-free auto-restart wahan kabhi kabhi ruk sakta hai, tab button dabana hoga.
* Shop ki price ab sab se mehngi variant wali price hai; agar aap variant wise alag price chahte hain to wo next version mein (variant-level price field) ho sakta hai.
