# MIZANORA v53.0.0 — Live TV Track Engine: quality aur audio jo asal mein switch hoti hai

Aap ki shikayat thi: *“audio aur quality tracking abhi bhi SIRAVEX player ki tarah track nahi karti,
yeh kuch bhi nahi pata; player ko mazeed professional banao, har tarah ki stream play kare.”*

v53 ka jawab ek **Track engine** hai — har switch engine par lagta hai aur **verified** hota hai: har switch pehle **engine** par lagta hai, phir engine se
**tasdeeq** (verify) hoti hai, aur agar engine mana kar de to player **sach batata hai** — menu par
jhoota tick nahi lagta.

---

## 1. Masla kya tha (asal wajah)

| # | Bug | Nateeja |
|---|---|---|
| 1 | `capLevelToPlayerSize: true` | 1080p chunte hi hls.js usay chhote player ke size par **cap** kar deta tha → quality “switch nahi hoti” lagti thi. |
| 2 | Sirf `h.currentLevel` set hota tha | ABR agli fragment par apni marzi ka level le leta tha (drift). |
| 3 | Audio switch fire-and-forget | `h.audioTrack = n` set hota tha, magar **confirm** koi nahi karta tha; fail ho jata to menu phir bhi tick dikhata. |
| 4 | DASH par sirf `setRepresentationForTypeByIndex` | `abr.autoSwitchBitrate` band na hone se dash.js wapas auto par chala jata tha. |
| 5 | Native / multi-audio (Safari, MP4) | `video.audioTracks` list parh hi nahi rahi thi. |
| 6 | Extensionless links | Sirf HLS try hota tha; MP4 link ho to “channel dead”. |

---

## 2. Naya Track engine — 5 hisse

### (a) Engine ladder — har link ke liye 2–3 mauqe

`lib/liveTvTracks.js → engineLadder(kind)`

| Link | Engine order |
|---|---|
| `.m3u8` | **HLS → MP4** |
| `.mpd` | **DASH → HLS → MP4** |
| `.mp4/.webm/.mov` | **MP4 → HLS** |
| `.mp3/.aac/flac` | **MP4 → HLS** (audio element) |
| extension nahi | **HLS → MP4** |
| `.m3u` (playlist) | koi nahi — saaf message |
| `rtmp://`, `rtsp://`, `udp://` | koi nahi — “browser support nahi karta” |

Har engine fail hone par player **agla engine** khud try karta hai, phir relay, phir backup source.
Failure screen par dikhta hai: **Engine: DASH → HLS** aur `Engine dobara` button.

### (b) Quality — mode ka matlab har jagah same

`modeIndex(levels, mode)` **resolution** se sort karta hai (list ki position se nahi), is liye:

- `High` = sab se bara resolution (1080p/4K)
- `Balanced` = darmiyan wala
- `Data saver` = sab se chhota
- `Auto` = ABR (hls.js / dash.js khud)

HLS par: `capLevelToPlayerSize` **band**, `autoLevelCapping = -1`, `currentLevel`, `nextLevel`,
`loadLevel` — chaar jagah pin lagta hai. Phir bhi drift ho to `LEVEL_SWITCHED` par **do dafa**
nudge hota hai. DASH par `abr.autoSwitchBitrate.video = false` + exact representation.

### (c) Audio — teeno engine, tasdeeq ke saath

| Engine | Switch | Tasdeeq |
|---|---|---|
| hls.js | `h.audioTrack = n` | `AUDIO_TRACK_SWITCHED` event |
| dash.js | `setCurrentTrack(tracks[n])` | `TRACK_CHANGE` / `getCurrentTrackFor` |
| Native (Safari/Firefox) | `video.audioTracks[i].enabled` | foran (browser synchronous hai) |

- Menu par **sirf tab tick** jab engine ne confirm kiya; warna “switch ho rahi hai…” spinner.
- 2.5 second mein confirm na ho → ek dafa **dobara** try, phir sach: *“is stream ka player is switch
  ko nahi kar pa raha.”*
- **Zubaan yaad rehti hai**: har host ke liye (`mz_tv_aud_<host>`). Urdu pehle, phir English, Hindi,
  Arabic — ya stream ka `DEFAULT=YES`.
- **Auto-pick**: naya channel khulte hi wohi zubaan khud lag jati hai (manual chunao ko chhua nahi
  jata).

### (d) Captions

`hls.subtitleDisplay` + `subtitleTrack`, DASH `setTextTrack`, native `textTracks[i].mode`.

### (e) Live tasdeeq UI

- Bar par: `Switch` chip (pending), quality (`1080p`), audio (`URDU`).
- Top bar par: engine (`HLS`/`DASH`/`MP4`) aur audio language badge.
- Stats panel: naya **Engine** row.
- Settings → Quality/Audio mein spinner + “kaun si quality ab chal rahi hai”.

---

## 3. “Har tarah ki stream” — link detection behtar

`channelTarget()` (lib/liveTv.js) ab extension **poore address** mein dhoondta hai:

```
https://host/live/1?format=m3u8   -> HLS
https://host/live/2?type=mpd      -> DASH
https://host/vod?file=movie.mp4   -> MP4
https://host/radio.flac           -> audio
https://host/list.m3u             -> playlist (message)
rtmp://host/live/1                -> unsupported (message)
https://host/unknown-panel-link   -> HLS, phir MP4
```

Naye audio formats: `flac`, `wav`, `weba`. Naye video: `ogv`.

---

## 4. Tests (scripts/test-v53.mjs — 7 groups)

1. **engine ladder** — har kind ka order + `engineChainLabel`.
2. **quality modes** — sorted aur unsorted level lists, empty list, `levelText`, `engineCanSwitch`.
3. **audio languages** — `normLang` aliases, Urdu/English order, default flag, single track, empty.
4. **track signature** — menu sirf tab re-read ho jab list badle.
5. **har tarah ka link** — 16 URL cases (HLS, DASH, MP4, audio, playlist, rtmp/rtsp/udp, YouTube).
6. **player wiring** — 21 behaviours (ladder, switchVideo/switchAudio, cap off, memory, confirm).
7. **release** — version 53.0.0, styles, doc, `npm test` chain.

Plus stability test: `applyQuality` sirf `switchVideo` par depend karta hai, warna stream effect
khud ko reload karta rehta (infinite loop).

---

## 5. Verification (is build par)

| Check | Nateeja |
|---|---|
| `npm run check` | 444 files, **0 problems**, typecheck clean |
| `npm test` | v52 5/5, **v53 7/7**, baaki sab suites green |
| `npm run build:offline` | green |
| Dev (MZ_TV_DEMO=1) | `/live`, `/live/<slug>` → 200 |

---

## 6. Agla round

- **EPG guide** (program timeline)
- **Multiview 2×2**
- **Admin stream health probe** (live/dead + last checked)
- **Catch-up archive**
