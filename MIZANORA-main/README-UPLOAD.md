# UPLOAD KARNE KA TAREEQA (2 minute) — products safe rahenge

1. Zip extract karein.
2. GitHub → apna repo → **Add file → Upload files**.
3. Extract ki hui **andar ki files/folders** drag karein: `app`, `components`, `lib`, `public`, `data` (ye sirf khali
   folder/manifest ke bagair), `content`, `scripts`, `package.json`, `README-UPLOAD.md`, `UPGRADE-v15.md`.
   (Poora `MIZANORA` folder nahi — us ke andar ki cheezein.)
4. **Commit changes** → Vercel khud deploy kar dega (1-3 minute).

## Ye zaroor yaad rakhein
* Is zip me **`data/catalog/` ke products ki koi file nahi** hai — is liye upload aap ke products ko **chhuega bhi nahi**.
  Purane products, prices aur manifest exactly waise hi rahenge.
* GitHub par upload sirf unhi files ko replace karta hai jo zip me hain; baqi sab (aap ki product files bhi) safe rehti hai.
* **Kabhi na karein:** `data/catalog` folder delete karna ya GitHub ka "delete all files" istemal karna.
* Agar `manifest.json` kabhi khali ho jaye to ghabrayein nahi: shop khud folder scan kar ke products wapas la leti hai
  (self-healing).
* Vercel env me ye hona chahiye: `GITHUB_TOKEN` + `GITHUB_REPO` (products files ke liye),
  `FIREBASE_DATABASE_URL` (assistant memory), Firebase keys (orders), aur optional `INDEXNOW_KEY`, `HOME_WINDOW`, `REEL_PARTS`.

## Deploy ke baad 5 second ka check
- Home par purane products nazar aayein (video wale bhi, thumbnail ke sath).
- `/reels` par catalog ki videos.
- Assistant → mic → **Allow** → boliye "kurti dikhao".
- Phone par **Install app** ka button.
