# v49 — Live TV rebuild: Tamasha-style grid, fastest player, M3U/Xtream import fix

Aap ka hukm tha: **"Live TV section ko rebuild kro, fastest player jisme audio track, captions,
video resolution/quality capture sab better ho, channels grids mein khoobsurat lagen jese Tamasha
web ka Live TV, aur M3U/Xtream se channels load nahi ho rahe — koi button nazar nahi aata, sab
shi kro. Beautiful blogs likho is update per."**

v49 exactly wahi karta hai. Version **49.0.0**. Branch `arena/2491fc50-mizanora`.

---

## 1. Naya player (`components/LiveTvPlayer.js`, `lib/liveTvUi.js`, `app/globals.css`)

Purana design khatam. Ab:

| Naya | Matlab |
|---|---|
| **Tamasha-style channel grid** | Player ke neeche tamam channels rangon walay tiles mein: har channel ka apna deterministic rang (hue), bara logo ya initials, LIVE patti, CH number, chalne wale par golden frame + equalizer bars, hover par play, pasandeeda dil har card par |
| **Grid / List view + Sort** | Tiles ya compact rows; Default / Naam A–Z / Group ke hisaab se; scroll par khud mazeed load (IntersectionObserver), 100k channels par bhi halka |
| **Apna custom control bar** | Play/pause, Pichla/Agla, volume slider, **LIVE chip with latency** (-12s → tap = live edge), ab chal rahi quality ka label, camera, settings, PiP, full screen (mobile par landscape lock ki koshish) — bar dekhte hue khud ghayib, hath lagane par wapis |
| **Asal resolution capture** | Settings mein Auto/High/Balanced/Data saver KE SAATH stream ki asal resolutions bitrate ke saath (1080p60 · 5 Mbps...). Pin karne par hls.js ABR ab waqai band hota hai (`autoLevelEnabled`) — pehle choose karne ke bawajood player apni marzi par wapis ja sakta tha |
| **Audio tracks — asal mein** | HLS ke alternate-audio tracks (name + zubaan + channels) ab waqai list aur switch hote hain; **full hls.js** build load hoti hai (light mein embedded captions hi nahi thay) |
| **Captions/subtitles** | HLS subtitle tracks + embedded CEA-608, Off/choose, khubsoorat `::cue` styling |
| **DASH fix** | Purana code dash.js v4 ke `getAvailableBitrateListFor`/`setCurrentQualityFor`/`setAutoSwitchQuality` bulata tha jo **v5 mein hain hi nahi** — quality/audio menus khamoshi se khali thay. Ab v5 APIs: `getRepresentationsByType`, `setRepresentationForTypeByIndex`, `getTracksFor`, `setCurrentTrack`, `setTextTrack`, `updateSettings(autoSwitchBitrate)`, aur factory ki dono shapes (`MediaPlayer()` / `.create()`) sambhali gayi hain |
| **Stats capture panel** | Resolution, quality level, bandwidth estimate, buffer ahead, live se latency, dropped frames, codec, audio track, Direct/Relay — har second |
| **Photo capture** | Camera button (ya **C**) mojuda frame ko asal resolution mein PNG bana kar save karta hai; protected stream ho to saaf message |
| **Tez shuruaat** | Bandwidth-test shuru mein, `navigator.connection.downlink` se behtar starting estimate, card par hover/touch se host preconnect ("garam connection"), current+next+previous hosts ki preconnect, muted autoplay |
| **Phone ki sahulatain** | Swipe se channel, Media Session (lock screen par next/previous), Wake Lock (dekhte hue screen band nahi), double-tap/click full screen, keys: Space/K, ↑↓ awaaz, C photo, S settings ke sath purani sari |
| **LIVE ribbon bug fix** | Tasveer par LIVE badge pehle `ready` state par LIVE aur **chaltay hue par "CONNECTING"** dikhata tha. Ab playing = LIVE, ruka hua = PAUSED |
| **Nayi theme: Vibe (Purple)** | Cinema ke sath Tamasha-jaisi purple/magenta theme (`data-theme="vibe"`) Admin theme list mein bhi aa gayi |

Jo pehle tha woh sab rehta hai: signed relay + uski yaad, backup streams, auto-skip (6 had tak),
stuck-buffer watchdog, channel ads, favourites/recents, har channel ka `/live/<slug>` page.

## 2. M3U / Xtream se channels load na honay ke ASAL bugs (sab fix)

| Bug | Nishani | Fix |
|---|---|---|
| **`commit` dead code tha** (`app/api/admin/tv/xtream/route.js`): "Straight into the shop" wala block aik unconditional `return` ke **neeche** parha tha — kabhi chalta hi nahi tha | Import save hi nahi hota tha; baray panel par "too big, press Straight into the shop" ka loop | Route dobara likhi gayi: test / commit / import ke alag branches, commit pehle, 0 channels par saaf inkaar |
| **Groups naam se, filter ID se** — UI `picked` mein group NAMES bhejti thi, server category IDs se filter karta tha | Koi bhi group tick karo → **0 channels** import | `xtreamTest` ab har group ke saath uski **category id** deta hai; UI id se pick karti hai; server naam aaye to `idByName` se khud resolve karta hai; na mile to waazeh error, khamosh zero nahi; categories load na hon to sab import + note |
| **M3U link loader redirects refuse karta tha** (`redirect:'error'`) | Panel/github/short links sab fail | Redirects **hath se** follow (har hop par DNS + private-IP check, max 5) |
| **Sirf https qabool** | Aksar panel playlists `http://host:8080/get.php` — sab refuse | http/https dono (uplink ab bhi private addresses par band) |
| **2 MB / 15 s ki had** | Bari playlist adhoori/timeout | **32 MB / 45 s**, gzip, clear Roman-Urdu/English error messages; bina #EXTINF wali plain URL lists bhi qabool |
| **Buttons nazar nahi aatay thay** | Xtream box list-load fail par poora ghayib; paste button sirf likhne ke baad; Load khali box par disabled-beghair-wajah | XtreamImport **hamesha** render (editor import loadErr par router message ke saath mana); import buttons test se pehle bhi nazar (disabled + wajah); paste button hamesha; Load button gold, hamesha dabta hai, khali ho to khud samjhata hai; Quick preset tap par "ab Load dabayein" ka message |
| **Session errors khamosh** | Signed-out tab par `Cannot read properties of null` | Token null-safe har jagah (admin page ka `token()` helper hi fromLink/Xtream dono use karte hain) |

## 3. `/live` page

- Cinematic hero: NAYA PLAYER badge, live channels/groups counts, teen khubiyon ki aik jhalak.
- **"Tamam Live TV Channels"** ab chip-links ki jagah logo/initials wala khoobsurat grid hai
  (har card apni `/live/<slug>` page par — SEO slugs wohi purani).
- Teen nayi guides ke links page ke aakhir mein.

## 4. Blogs (3 nayi + 2 refreshed)

| Guide | Kis ke liye |
|---|---|
| `mizanora-live-tv-v49-naya-player-beautiful-grid` | Announcement: naya grid, player, capture, import fixes |
| `live-tv-video-quality-audio-track-capture-guide` | Har viewer ke liye: resolution, audio track, captions, photo capture, stats, tricks |
| `live-tv-channels-load-problem-fix-guide` | Admin ke liye: teeno load-bugs ki nishani/wajah/hal, step-by-step sahi tareeqa |
| `mizanora-live-tv-all-channels-search-favourites` (refreshed) | v49 section + nayi guides ke links |
| `mizanora-live-tv-audio-tracks-video-quality` (refreshed) | v49 section (asal resolutions, dono engines par audio, embedded captions) |

Filename rule (v48) ka khayal: kisi nayi file ke naam mein `iptv/xtream/tivimate/stalker/siravex`
nahi — is liye fix-guide ka naam "live-tv-channels-load-problem" rakha gaya hai.

## 5. Tests

- Nayi `scripts/test-v49.mjs` (helpers runtime, player features, commit reachability ka structural
  check, group-id flow, tv-import ki nayi hudood, blogs, wiring) — `npm test` chain mein shamil.
- `scripts/test-v26.mjs` + `test-v28.mjs`: `hls.js/light` → full `hls.js` (wajah test mein likhi hai).
- `scripts/test-v24.mjs`: tv-import `redirect:'error'` → manual-follow + `assertPublic` har hop par.
- Baaki tamam puranay checks (v20–v48, admin-tv, player v32) baghair tabdeeli pass.

## 6. Zara ehtiyaat

- Streams wohi dikhayein jinka haq aapke paas hai. http streams dukaan ke relay se chalte hain —
  hosting bandwidth lagti hai, is liye list sanjeeda rakhein aur *Check all channels* chala kar
  dead channels off karte rahein.
- Full hls.js light se ~90 KB (gzip) bari hai, lekin woh tab hi load hoti hai jab /live khulta hai,
  aur usi ke badle audio tracks + embedded captions asal mein chalte hain.
