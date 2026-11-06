# MIZANORA v52.0.0 — Live TV Player: SIRAVEX se bhi aage

Aap ka hukm tha: *“Live TV SIRAVEX level player is polish karo, SIRAVEX player se bhi best level.”*

v52 wahi karta hai. Player ka har naya hissa neeche aasan lafzon mein — aur har feature ke saath yeh bhi
likha hai ke **test kaise hota hai**.

---

## 1. Pehle kya tha, ab kya hai

v49 ka player pehle se HLS + DASH + MP4, asal resolutions (1080p/720p + bitrate), audio tracks,
captions, PiP, fullscreen, stats aur photo capture samajhta tha. v52 us ke **upar** woh cheezein
laata hai jo aaj ke best IPTV players (SIRAVEX jaise) mein hoti hain — aur kuch us se ziyada:

| # | Naya feature | Kya hota hai |
|---|---|---|
| 1 | **Channel-number zapping** | Remote/keyboard se `1 2` likhein → 1.4 second baad seedha **CH 12**. Range se bahar ho (`99`) to saaf message: *“Channel 99 maujood nahi (1–40)”*. |
| 2 | **Zap OSD banner** | Har channel change par bara number + logo + naam + group ka banner (2.4s), SIRAVEX jaisa. |
| 3 | **Sleep timer** | `Off / 15 / 30 / 60 / 90` minute. Countdown top bar mein (`🌙 12:41`), 1 minute baqi par warning, phir playback khud band — *“Sleep timer: playback band. Good night!”* |
| 4 | **Gesture HUD (mobile)** | Left/right swipe = channel, **up/down swipe = awaaz** — dono par bara HUD (volume % bar ya “Agla/Pichla channel”). |
| 5 | **Keyboard shortcuts sheet** | `?` dabayein → poore player ki keys ki list (14 shortcuts). `Esc` se band. |
| 6 | **Timeshift (−30s)** | Jin live streams ke paas DVR window hai, wahan `30s` button: peechay jaayein, `LIVE` se wapas edge par. Buffer na ho to imandari se “buffer nahi hai”. |
| 7 | **Cast / Chromecast** | Browser ke Remote Playback API se TV par bhejein (jahan browser support kare) — button sirf tab dikhta hai jab mumkin ho. |
| 8 | **Per-host picture memory** | Kisi stream host par 1080p chuna? Agli dafa usi host ke channels 1080p par khulte hain (`mz_tv_lvl_<host>`); `Auto` chunne par wapas network ke hawale. |
| 9 | **“Last channel” resume** | Bina channel link ke page kholein → pichla channel khud khul jata hai (browser par yaad, server par nahi). |
| 10 | **Channel ke rang ka glow** | Screen ka halka accent us channel ke apne hue se — har channel ka apna mizaj. |

---

## 2. Keyboard — poora remote

| Key | Kaam |
|---|---|
| `←` `→` | Pichla / agla channel |
| `↑` `↓` | Awaaz barhana / kam |
| `0–9` | Channel number likh kar jump |
| `Space` / `K` | Play / pause |
| `M` | Mute |
| `L` | Live edge par wapas |
| `C` | Photo capture |
| `P` | Picture in picture |
| `F` | Full screen |
| `R` | Random channel |
| `S` | Settings (quality, awaaz, captions, more) |
| `T` | Sleep timer cycle (15 → 30 → 60 → 90 → off) |
| `/` ya `G` | Channel search |
| `?` | Shortcuts sheet |
| `Esc` | Panel / sheet band |

Phone par: left/right swipe = channel, up/down = awaaz, double-tap = full screen, screen par tap = controls.

---

## 3. Techniki tafseel (developers ke liye)

`lib/liveTvUi.js` (pure, browser ke baghair test hota hai):

```js
sleepClock(3725)        // "1:02:05"
sleepClock(90)          // "1:30"
typedChannel('12', 40)  // 11   -> channel 12 ka index
typedChannel('99', 40)  // -1   -> kuch nahi hota
SLEEP_PRESETS           // [0, 15, 30, 60, 90]
```

`components/LiveTvPlayer.js`:

- `zap` / `typing` state + `ZAP_MS` / `TYPE_MS` — OSD khud clear hota hai (`setZap(null)` timeout, cleanup mein clear).
- `sleepMins` / `sleepLeft` + ek hi `setInterval`, `sleepClock()` se display; `0` par `pause()` + message.
- `flashHud()` + `hudTimer` — swipe gestures, 1.1s baad gayab.
- `skipBack(30)` — `video.seekable.start(0)` se guard; DVR window `dvr` state har second update.
- `castTo()` — `video.remote.prompt()` (Remote Playback API), `canCast` sirf support hone par.
- `pickLevel()` / `pickMode()` — `writePref('mz_tv_lvl_<host>')`; stream load par wohi level wapas lagta hai.
- `writePref('mz_tv_last')` — page khulte waqt `initialSlug` na ho to wohi channel.
- `SHORTCUTS` array — sheet ka single source of truth.

`app/globals.css` — `.mztv-zap`, `.mztv-hud`, `.mztv-help`, `.mztv-badge.is-sleep`; phones ke liye
chhota zap banner, aur `prefers-reduced-motion` par animations off.

Sab kuch **is browser mein** rehta hai (localStorage/sessionStorage). Koi account, koi tracking nahi.

---

## 4. Tests

`scripts/test-v52.mjs` — 5 groups:

1. `sleepClock` — 0:45, 1:30, 1:02:05, negative, string input.
2. `typedChannel` — 1→0, 12→11, `040`→39, 0/99/abc/empty → −1, khali list → −1.
3. Player wiring — 24 behaviours (zap, sleep, HUD, cast, timeshift, memory, keys) source se verify.
4. Cleanup — timers, listeners, OSD.
5. Release — version `52.0.0`, `UPGRADE-v52.md`, `npm test` chain.

`npm test` ab **v52** bhi chalata hai; `test-v51.mjs` ka version check `>= 51` kar diya gaya hai taake
chain aage bhi na tootay.

---

## 5. Verification (is build par)

| Check | Nateeja |
|---|---|
| `npm run check` | 443 files, **0 problems**, typecheck clean |
| `npm test` | sab suites green (v51 12/12, v52 5/5) |
| `npm run build:offline` | green, `/live/[slug]` aur admin routes jaisay thay |
| Dev smoke | `/live`, `/live/<channel>`, `/admin/live-channel` — 200 |

---

## 6. Aage kya (v53 ke liye tayyar)

- **EPG guide** (programme timeline) — channel data ke saath.
- **Multiview 2×2** — 4 channels ek screen par.
- **Admin stream health probe** — har channel ka live/dead status aur last-checked time.
- **Catch-up archive** — pichle 24 ghante ke programmes (agar source de).

Bataiye kaunsa pehle chahiye.
