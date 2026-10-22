# Mizanora v17.0.0 — kya naya hai

v16 ke upar ye 4 kaam hue hain: Reels page seedha reels kholta hai, app mein touch sounds aate hain, Mizanora background music admin panel se set hota hai, aur voice assistant ko call jaisa banaya gaya hai.

## 1. Reels page seedha reels kholta hai
- `/reels` par ab intro text nahi hai. Page khulte hi reels ka full-screen feed chalta hai (random order).
- Bottom navigation ka Reels button bhi yahi kholta hai. Dobara tap karne par reels phir se shuffle hote hain.
- Viewer ke andar ek **Shuffle** button hai jo reels ko naye order mein laata hai.
- Home page par reels ki row bhi wahi music use karti hai.

## 2. Mizanora background music (admin se set hota hai)
- **Admin panel → Reels** mein upar **"Mizanora background music"** card hai.
- Wahan ek **direct audio link** paste karein (`.mp3`, `.m4a`, `.ogg`, `.wav` par khatam hona chahiye). Save karne ke baad link `siteMeta/reelMusic` Firestore doc mein jaata hai aur site ka cache refresh hota hai.
- **Test play** se pehle sun sakte hain. **Remove link** se music band ho jaati hai.
- Google Drive share link aur Dropbox link khud-ba-khud direct link mein badal jaate hain (jahan possible ho).
- Behavior:
  - Reel mein **awaaz nahi** (silent video) → Mizanora music chalta hai.
  - Reel mein **apni awaaz hai** → music band ho jaata hai, sirf reel ki awaaz aati hai.
  - Iframe reels (YouTube, Facebook, Instagram, TikTok) ko "awaaz wali" maana jaata hai, is liye un par music nahi chalta.
- Browser autoplay rokta hai: pehli tap (screen par kahin bhi) par music shuru hota hai.
- Viewer mein **music on/off** button hai. Pasand localStorage mein save hoti hai (`mz_reel_music`).

**Limits:**
- Link khud ek direct audio file honi chahiye. Cloudinary audio upload support karta hai. ImgBB audio support nahi karta.
- Silent reel ki pehchaan browser ki codec support par depend karti hai. Jo browser awaaz ka pata nahi laga sakta, wahan reel ko "awaaz wali" maana jaata hai (music band rehta hai, is se galat awaaz nahi milti).
- Music ka volume admin mein set hota hai (0–100%).

## 3. App touch sounds
- Har button par halki tap sound (`sfx.tap`), lekin ek saath bahut zyada na bajne ke liye throttle lagaya gaya hai.
- Alag sounds: **cart mein add** (`sfx.add`), **wishlist** (`sfx.wish`), **coupon lagne par** (`sfx.coupon`), **coupon galat** (`sfx.error`), **order ho gaya** par thank-you page (`sfx.success`).
- Jin buttons ka apna sound hai (add, wish, apply, place order, confirm), un par plain tap sound skip hota hai, taake do sound ek saath na bajein.
- Header mein **sound on/off** button hai. Choice localStorage mein save hoti hai. Jis element par `data-nosound` ho, us par tap sound nahi bajta.

**Limits:** Mobile browsers ki policy ke mutabiq pehli tap ke baghair audio nahi bajta. Sound ka volume device ke volume par depend karta hai.

## 4. Voice assistant: call jaisa mode
- Assistant panel mein **Voice call** button hai. Call start karne par full-screen call overlay khulta hai (orb, status, hang-up button).
- Call mein hands-free loop chalta hai: aap bolte hain, woh jawab deti hai, phir khud sunne lagti hai.
- Jab woh bol rahi hoti hai to mic sunna rok deta hai (wait karta hai).
- **Echo filter:** agar mic uski apni awaaz pakad le to woh drop ho jaati hai (60% word overlap ke saath check hota hai). Asli sawal ko drop nahi kiya jaata.
- Lambe jawab chhote chunks mein bolte hain (Chrome ke ~15 second cutoff se bachne ke liye). Agar speech 2.5 second se zyada atki rahe to default voice se dobara koshish hoti hai.
- Keep-alive hata diya gaya hai (Android par pause/resume se speech cancel ho jaati thi).

**Limits:** Mic sirf HTTPS par aur permission milne ke baad kaam karta hai. Bolne ki accuracy browser aur phone ke speech recognition par depend karti hai. Urdu voice device mein installed voices par depend karti hai.

## 5. Baaki changes
- `package.json` version **17.0.0**.
- `npm test` ab import, voice (echo cases samet) aur music link tests chalata hai.
- Admin mein music save karne ke liye `/api/revalidate` ab tag `reel-music` bhi refresh karta hai.

## Verify karne ke liye (deploy ke baad)
1. Phone par `/reels` kholen: reels seedha chalein, Shuffle kaam kare.
2. Admin → Reels mein music link paste karke Save karein. Silent reel par music aana chahiye, awaaz wali reel par band.
3. Header mein sound button se sounds on/off karein.
4. Assistant → Voice call: call shuru karke 2–3 sawal poochhein.

## Test kya nahi hua
- Real mic, Firebase, Gemini, aur Vercel deploy is sandbox mein test nahi ho sake.
- Browser mein voice, reels aur sounds ka behaviour verify nahi hua (sandbox mein Chromium launch nahi hota).
- Build, check, typecheck, tests aur route curl checks pass hue hain.
