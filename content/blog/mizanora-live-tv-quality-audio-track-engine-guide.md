---
title: Mizanora Live TV: Quality aur Audio Ab Har Stream Par Sach Mein Switch Hoti Hai
slug: mizanora-live-tv-quality-audio-track-engine-guide
description: Mizanora Live TV ka naya Track Engine — 1080p chunein to 1080p chalti hai, Urdu audio chunein to Urdu sunai deti hai. HLS, DASH aur browser ke apne player teeno par, tasdeeq ke saath. Har tarah ke link ki poori guide.
date: 2026-11-06
category: Live TV
---

Pehle aisa hota tha: quality menu mein **1080p** par tick lagta, magar picture 480p hi rehti. Audio
menu se **Urdu** chunte, magar awaaz English hi aati. Menu jhoot bol raha tha, kyunki koi yeh check
nahi karta tha ke player ne woh switch kiya bhi ya nahi.

v53 mein yeh badal gaya. Ab player **tasdeeq** (verify) karta hai — aur sach batata hai.

## Quality: ab asal mein switch hoti hai

Chaar cheezein theek ki gayin:

1. **Size cap band.** Pehle player apne box ke size ke mutabiq quality cap kar deta tha — chhote
   player par 1080p chunne ka koi faida nahi hota tha. Ab manual chunao par cap khud band ho jata
   hai.
2. **Chaar jagah pin.** Sirf ek property nahi, `currentLevel` + `nextLevel` + `loadLevel` +
   `autoLevelCapping` — taake agli fragment par bhi wohi quality rahe.
3. **Drift guard.** Agar engine phir bhi apni marzi kare, player do dafa wapas pin karta hai.
4. **Tasdeeq.** “Picture: 1080p chalu hai ✓” sirf tab aata hai jab engine ne woh level diya ho.

**High / Balanced / Data saver** ka matlab ab har jagah same hai — resolution se tay hota hai, list
ki position se nahi. Is liye DASH aur HLS dono par ek jaisa behave karta hai.

## Audio: teen engine, teen tareeqe, ek nateeja

| Aap ka stream | Player kaise switch karta hai |
|---|---|
| HLS (hls.js) | `hls.audioTrack` → engine ka `AUDIO_TRACK_SWITCHED` event |
| DASH (dash.js) | `setCurrentTrack` → `TRACK_CHANGE` |
| Safari / native | browser ki apni `audioTracks` list |

- Menu par tick **sirf confirm hone ke baad**. Warna “Awaaz switch ho rahi hai…” spinner.
- 2.5 second mein jawab na aaye to player **ek dafa dobara** koshish karta hai, phir saaf keh deta
  hai: *“is stream ka player is switch ko nahi kar pa raha.”*
- **Zubaan yaad rehti hai.** Kisi host par Urdu chuni? Agli dafa usi host ke channels Urdu par
  khulenge. (`mz_tv_aud_<host>`)
- Agar aap ne kabhi audio na chuna ho, player khud **Urdu → English → Hindi → Arabic** tarteeb se
  behtareen track chun leta hai.
- Ab bar par bhi dikhta hai: `1080p` · `URDU` · `HLS`.

## Har tarah ki stream

Player ab link ko behtar pehchanta hai — extension poore address mein dhoondta hai:

- `?format=m3u8`, `?type=mpd`, `?file=movie.mp4` jaise links bhi sahi chalti hain.
- `.flac`, `.wav`, `.weba` audio bhi.
- **Extensionless** IPTV links (jo aaj kal bohat aam hain) ab HLS try karte hain, na chale to
  browser ka apna player.
- Ek engine fail ho to **agla engine** khud try hota hai: `DASH → HLS → MP4`, phir relay, phir backup
  source.
- `rtmp://`, `rtsp://`, `udp://` par imandari se likha aata hai ke browser inhein support nahi karta —
  aur HLS/MP4 link dene ki hidayat.

## Chhoti chhoti baatein jo farq daalti hain

- **Failure screen** par ab dikhta hai kaunse engine try hue: `Engine: DASH → HLS` + `Engine dobara`
  button.
- **Stats panel** mein naya `Engine` row.
- **Captions** bhi wohi tasdeeq wala tareeqa: HLS `subtitleDisplay`, DASH `setTextTrack`, native
  `textTracks`.
- Playback engine ka naam top bar par badge ki tarah: `HLS`, `DASH` ya `MP4`.

## Aap kya karein

1. `/live` kholein.
2. Settings → **Quality** → `1080p` chunein. Ab tick ke saath “1080p chalu hai ✓” aayega.
3. Settings → **Awaaz** → Urdu/English. Bar par bhi language badal jayegi.
4. Kisi channel par masla ho to failure screen par `Engine dobara` dabayein — doosra engine try hoga.

Bas. Ab menu aur picture ke darmiyan koi jhoot nahi.
