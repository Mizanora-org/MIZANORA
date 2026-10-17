# Mizanora v19 — bug fixes

1. **Reels ke upar header dikhna** — theek. Wajah: page ki fade animation (`.mz-page`, `animation ... both`) ek stacking layer bana deti thi, is liye full-screen reels header ke neeche phans jaate the. Ab animation `backwards` hai aur reels viewer `document.body` par portal ke zariye khulta hai (z-100), is liye header kabhi reel ke upar nahi aata.
2. **Images / posters load na hona** — product card, product gallery, thumbnails, worker list aur reels ke poster: pehle Next ka optimiser, na chale to browser seedha (no-referrer) photo load karta hai, phir hi card hataya jata hai.
3. **Phone par product ka buy bar** bottom tab bar ke upar chhup raha tha — ab tab bar ke theek upar hai.
4. **App background music** — phone par pehli tap se music shuru nahi hota tha (`touchstart/pointerdown` browser ke liye gesture nahi). Ab `touchend/pointerup/click` par unlock hota hai.
5. **Worker profit slabs** (`lib/workers.js` -> `PRICE_BANDS`): product Rs 1000 tak 10%, Rs 2000 tak 15%, Rs 3000 tak 20%, 3000 se upar 20% (`TOP_BAND_PCT`). Commission aur Elite worker ka apna profit (markup) dono isi slab se limit hote hain. Server, worker dashboard, /workers page sab isi se chalte hain.
