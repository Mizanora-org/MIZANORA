# Mizanora v27 — Quran & Hadith Live Channel

Upgrade: purani files ko is files se replace karein, GitHub par commit, Vercel deploy. Koi naya npm package nahi. Naye environment variables sirf YouTube live cast ke liye optional hain (neeche). Firebase rules mein kuch nahi badalna.

## 1. Live Channel: asli TV channel, dukaan ke andar
`/live-channel` ab ek **poora channel** hai — jaise TV channel chalta hai:
- **Upar channel ki tarah**: shimmering MIZANORA logo, laal **LIVE** pill, aur **Pakistan ka chalta hua waqt** (PKT, Hijri date ke sath).
- **Beech mein program**: live Quran ki tilawat (ayat glow animation ke sath, har lafz jalti hui roshni mein), phir **hadith ki tilawat** (book + riwayat number + grade), phir **product ad break** (photo, price, AI voiceover).
- **Neeche**: lower-third bar (ab kya chal raha hai + progress), **EPG strip** (NOW / NEXT / LATER), aur ticker (hadith/dua lines).
- Program ka tareeqa-kar: **[Quran tilawat] → [Hadith] → [Ad]**, cycle ke baad cycle. Sab kuch **wall clock se tay hota hai** (lib/liveChannel.js) — is liye ek hi second par duniya bhar ke sab visitors ko ek hi ayat, ek hi hadith aur ek hi product dikhta hai. Ye playlist nahi, broadcast hai.

## 2. Live M3U8 stream (`/api/live/channel.m3u8`)
- Channel ki programming ki **asli HLS playlist**: har ayah ka apna recitation file (Islamic Network CDN), har hadith/ad ki apni AI voiceover (`/api/live/voice/<id>.wav`).
- VLC, ffmpeg, koi bhi HLS player — aur YouTube (cast action ke zariye) isko chala sakta hai.
- Jis slot ki voiceover abhi bani nahi, wahan **Quran audio fill** hota hai — stream kabhi khamosh nahi hoti.
- `/api/live/channel` = player ka state API (ab kya chal raha hai, agla program, product details, PKT clock).

## 3. Admin > Live Channel (control desk)
- **On Air**: channel on/off, title, slogan, theme (emerald / night / gold), ticker lines, "Go live now for N minutes", links (page + m3u8 copy).
- **Schedule**: Pakistan time ke windows (dino ke sath), aur cadence: kitne minute tilawat, kitne minute hadith, kitni second ki ad.
- **Quran & Hadith**: start surah (rotation poori Quran ghoomti hai), reciter, translation, ghoomti hui hadith books (Bukhari, Muslim, Nawawi...), hadith ki zubaan, aur **AI voice**.
- **Products & Ads**: product search karke ad list banayein, har ad ka **voiceover script** likhein aur **"AI voiceover banayein"** dabayein — Gemini TTS se awaaz banti hai aur channel usi waqt se usko bajana shuru kar deta hai. Preview + delete bhi.
- **YouTube**: ek click par **YouTube live broadcast** ban jata hai (YouTube Data API + Live Streaming API): watch URL, RTMPS address aur stream key. Key GitHub secret `YOUTUBE_STREAM_KEY` mein rakhein — phir cast action live ho jata hai.

## 4. The "action": GitHub se 24/7 live cast (`.github/workflows/live-channel.yml`)
**Stream kabhi rukti nahi — timing master level:**
- **Ek run = 5.5 ghante ka non-stop push**: ek hi ffmpeg process, ek hi playlist jo poori budget cover karti hai — run ke andar **ek second ka bhi restart nahi**.
- **Baton handover**: run khatam hone se ~20 minute pehle wo **khud agla run dispatch** kar deta hai. Concurrency group usko queue mein lagata hai, aur jaise hi chal raha run rukta hai agla **usi second** shuru ho jata hai (~1 minute ka handover: sirf runner boot ka time).
- **Har 30 minute ka cron safety net**: hamesha ek taaza pending run majood rehti hai; agar baton mar bhi jaye to handover phir bhi hota hai. Off-air schedule mein naya run khud hi bahar nikal jata hai.
- **Program wall-clock se chalta hai**: kisi bhi reconnect/queue delay ke baad bhi stream bilkul usi ayat/hadith/ad se continue hoti hai jo us second website par chal rahi hoti hai.
- **Reconnect logic**: network/YouTube failure par ffmpeg backoff ke sath dobara judta hai; aur agar admin ne beech mein channel band kiya to run 2 minute pehle hi politely ruk jata hai.
- Inputs: `duration` (1-350 min, default 330 = 5.5h), `dry_run` (sirf playlist — safe test), `force` (schedule ke baghair bhi live), `no_chain` (single-shot test).
- Secrets: `YOUTUBE_STREAM_KEY` (zaroori), `LIVE_CHANNEL_API` (optional, default https://mizanora.vercel.app). `GITHUB_TOKEN` khud milta hai (baton ke liye workflow mein `actions: write` permission di gayi hai).

**Zero-gap 24/7 (literally ek second ka gap nahi):** GitHub runners ki 6-hour job limit hai, is liye wahan din mein 2 baar ~1 minute ka handover hota hai (YouTube broadcast live rehta hai, handover par sirf no-signal dikhta hai). Agar **bilkul zero** chahiye to apne PC ya kisi VPS par ek hi command chalayein:
```
npm run cast:live -- --loop
```
Yeh mode ek chhoti local playlist server ke zariye ffmpeg ko **live sliding HLS window** deta hai — ek hi process hafteon/dino tak chalta hai, koi job boundary nahi, sirf asli network failure par reconnect. Yehi asli 24/7 encoder hai (schedule ke off-air waqt yeh chup chaap intezaar karta hai, phir khud jud jata hai).

One-shot bhi: `npm run cast:live -- --minutes 330` (ffmpeg hona zaroori hai). `--dry-run` se pehle playlist dekh lein.

**YouTube API kaise setup karein (ek dafa):**
1. Google Cloud Console → naya project → **YouTube Data API v3** aur **YouTube Live Streaming API** enable karein.
2. OAuth consent screen (External, Testing mode theek hai) + **OAuth client ID** (Desktop app) banayein.
3. Refresh token banane ke liye OAuth 2.0 Playground use karein: `https://developers.google.com/oauthplayground/` → YouTube Data API v3 v3 scopes (`youtube`, `youtube.force-ssl`) → Authorize → **exchange for refresh token**.
4. Vercel (ya GitHub secrets) mein: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`.
5. Admin > Live Channel > YouTube → "Create YouTube live broadcast" → stream key copy → GitHub secret `YOUTUBE_STREAM_KEY`.
   Broadcast jaan boojh kar **enableAutoStop: false** banaya jata hai, taake encoder handover par YouTube broadcast kabhi khud complete na ho — watch page hamesha live rahe.

## 5. AI voiceover kaise kaam karta hai
- Gemini TTS (`gemini-2.5-flash-preview-tts` / `2.0`, wohi keys jo Admin > AI Assistant mein hain) se WAV banta hai, aur Firestore mein chhote base64 chunks mein mehfooz hota hai (`liveVoices` collection).
- Address hamesha same: `/api/live/voice/ad-<product-slug>.wav`, `/api/live/voice/h-<book>-<section>-<lang>.wav`. Regenerate karne par bhi address same rehta hai.
- Voiceover na hone par website wale visitor ke browser ki **speech synthesis** se ad/hadith bol deti hai (fallback); m3u8 stream mein wahi slot Quran se bhar jata hai.

## 6. Links aur safety
- Channel page: `/live-channel` (Islamic reminders page se bhi link hai). Admin sidebar mein "Live Channel".
- Sirf apni products ke ads, sirf asli hadith collections ka text (fawazahmed0 hadith-api), Quran ka text/karachi CDN se — kuch bhi haath se type nahi.
- Stream key kabhi public na karein; sirf GitHub secrets / Vercel env mein rakhein.
