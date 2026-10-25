# Mizanora v29 — Smooth Live TV, readable channels, private YouTube key

Upgrade: files replace karein, `npm ci`, commit, Vercel deploy.
**Zaroori:** `firestore.rules` Firebase Console mein dobara publish karein (naya `adminSecrets` rule) — apna admin UID/email wapas daal kar.

## 1. SECURITY (sab se zaroori)
Purani version YouTube stream key `siteMeta/liveChannel` mein save karti thi. `siteMeta` public-readable hai, yaani koi bhi wo key parh sakta tha.
- Key ab sirf `adminSecrets/liveChannelYoutube` mein jati hai (rules: browser ke liye band, sirf server).
- Admin kholte hi purani key khud private jagah move hoti hai aur public doc se mit jati hai.
- **Purani key ko compromised samjhein:** YouTube Studio mein stream key reset karein (ya naya broadcast banayein) aur nayi key admin panel mein save karein.

## 2. Admin panel se YouTube RTMP setup
Admin > Live Channel > YouTube > "YouTube RTMP key": Stream URL + Stream key paste karke Save. (YouTube API ke bina bhi chalta hai.)
Cast ko key dene ke liye (GitHub secret mein key copy karne ki zaroorat nahi):
1. Vercel env: `CAST_TOKEN` = lambi random value (24+ characters).
2. GitHub secret: `CAST_TOKEN` = wohi value.
3. Actions > "Live Channel" > Run workflow. Caster key `/api/live/cast-key` se khud le leta hai.
Purana tareeqa (`YOUTUBE_STREAM_KEY` GitHub secret) ab bhi chalta hai.

## 3. Live TV buffering
- HLS buffer 12s se 30s (max 60s), conservative bandwidth estimate, bounded retries.
- Buffer watchdog: spinner par 12s atakne par pehle playlist reload + live edge, phir relay, phir NO SIGNAL (auto-skip aage badh jata hai).
- Pehli playlist direct load na ho to retries ke bajaye seedha relay.
- Jis host ko relay chahiye tha wo us session mein agli dafa seedha relay se start hota hai.
- Retry dabane par direct raasta dobara try hota hai.

## 4. Channel icons aur names
- Guide ab 1 column (230px+ cards): name 2 lines tak poora dikhta hai (pehle 1 lines mein kat jata tha).
- Logo ke peeche safed background (dark logos ab nazar aate hain). Logo load na ho to Tv icon.
- `http://` logos ab drop nahi hote (https par upgrade try hota hai).

## 5. Live Channel (Quran & Hadith)
- Agla ayah peeche se download hota rehta hai: ayat ke beech gap/atakna kam.
- Audio file fail ho to ek automatic retry.
- Phones par heavy background animations band (kam heat, kam lag).

## 6. Jo is version mein NAHI kiya
Audio ka pitch/tempo badalna. Recitation audio doosron ki copyright recording hai; pitch badal kar YouTube ke copyright detection se bachna theek nahi, isliye ye feature nahi joda gaya.

## Tests
`npm test` (naya `scripts/test-v29.mjs`).
