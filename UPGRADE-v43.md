# v43 — Mizanora khud owner panel ban gaya (Xtream + Stalker, dono)

**Sab se bari tabdeeli:** pehle (v42) gateway kisi *upstream* Xtream panel se channels uthata tha.
Ab aisa nahi. **Mizanora apna content khud rakhta hai** — admin M3U file/link se ya haath se
channels, movies aur series daalta hai — aur wohi content **do protocol** par clients ko milta hai:

| Client | Kya milta hai | Login |
|---|---|---|
| Xtream apps (TiviMate, Smarters, XCIPTV, VLC) | `player_api.php`, `get.php`, `xmltv.php` | username + password |
| MAG / STB emu (Stalker portal) | `portal.php`, `server/load.php`, `/c/` | **MAC address** |

Admin ki lines aur reseller ki lines — dono par yeh dono protocols chaltay hain. Farq sirf itna
hai ke line kis ne banayi aur uska rate kya hai.

---

## 1. Content andar kaise aata hai

Admin > IPTV par teen cards hain:

1. **Live now & connections** — kaun online hai, kis app se, kaunsa channel (neeche tafseel).
2. **IPTV channel list** — live channels: M3U link ya paste se import, ya manual.
3. **Movies & series** — naya. M3U link/paste se import ya "Manual movie".

Import khud pehchanta hai:

```
#EXTINF:-1 group-title="Movies" tvg-logo="...",Film Name (2024)     -> movie (year 2024)
#EXTINF:-1 group-title="Series",Breaking Bad S01E02                -> series ka season 1, episode 2
#EXTINF:-1,Show 1x05                                                -> season 1, episode 5 bhi chalta hai
```

Ek hi series ke do episodes aayen to woh **aik hi series** ke do episodes ban jate hain (naam se
match hota hai). Dobara import karne par seasons/episodes jama hote hain, duplicate nahi bante.
Movie ki pehchan us ka **URL** hai — url wohi ho to purana record update hota hai, naya nahi banta.

Sab kuch Save dabane par 1 minute ke andar clients ko nazar aata hai (cache tag `iptv` clear hota hai).

---

## 2. Customer ko kya dena hai

Admin panel ke "Customer ko yeh dein" box se copy karein:

- **Xtream / M3U** — `https://mizanora.vercel.app/get.php?username=USER&password=PASS&type=m3u_plus&output=ts`
- **Stalker portal (MAG)** — `https://mizanora.vercel.app/c/`
- **EPG** — `https://mizanora.vercel.app/xmltv.php?username=USER&password=PASS`

Xtream app mein sirf server `https://mizanora.vercel.app` likhna hota hai — baqi app khud
`player_api.php` maang leta hai (rewrites isi liye hain).

**MAC line:** line banate waqt device **MAG** chunein. MAC khud ban jata hai (ya apna
`00:1A:79:xx:xx:xx` likh dein). Customer ko wohi MAC aur portal URL dena hai.
`iptvLines.mac` par hi Stalker login hota hai — username/password MAG mein nahi chalta.

---

## 3. Tracking — har cheez ka hisab

| Cheez | Kahan | Kya |
|---|---|---|
| `iptvSessions/{username}` | Firestore | ip, app (TiviMate/Smarters/XCIPTV/VLC/MAG/Kodi), device hash, channel, kind, lastSeen |
| `iptvEvents` | Firestore | `login`, `playlist`, `stream_start`, `line_created` — line, reseller, ip, app, waqt |
| Admin > Live now | panel | online lines, devices, 24h streams/logins, top apps, event log |
| Export | panel | poora **catalogue M3U** (backup) aur **MAC list CSV** |

Heartbeat har 30 second (Firestore par bojh na pare), event har 60 second per line+type.
5 minute tak heartbeat na aaye to line "offline" ginti hai.

**Device limit** waise hi chalta hai: 90 second ke andar jitne device hashes dikhe, unhi ki ginti.
Limit se zyada ho to stream band — "Too many connections".

---

## 4. Security (v42 wali, ab VOD par bhi)

- Channel/movie/episode ke **asli URLs** sirf server par: `siteMeta/iptvCatalogue` aur
  `siteMeta/iptvVod` browser ke liye **band** hain (firestore.rules), sirf Admin SDK padh sakta hai.
- Client ko milta hai **sealed token** (`v1.…`, AES-256-GCM, 3 ghante) — `/api/gw/s?t=…`.
  DevTools/network tab mein upstream ka naam kabhi nahi aata.
- HLS playlist ke andar har `#EXT-X-…URI` aur har segment bhi sealed hota hai.
- Stalker token bhi sealed hai (`handshake` par milta hai, 12 ghante) — MAC plain nahi ghoomta.
- SSRF guard (private IP block), per-IP rate limits (player 180, playlist 30, stream 240,
  pieces 900, epg 12, portal 240 /min), line + device check har request par.

**Env chahiye:** `IPTV_GW_SECRET` (32+ chars) aur `FIREBASE_SERVICE_ACCOUNT`. In ke baghair
gateway 503 deta hai — saaf message ke saath, chup-chaap kuch nahi hota.

---

## 5. Data model

```
siteMeta/iptvCatalogue   channels[{ id:"1", name, url, logo, group, off }]      (ids 1,2,3…)
siteMeta/iptvVod         movies[{ id:"m1", name, url, poster, group, year, rating, ext, plot, off }]
                         series[{ id:"s1", name, poster, group, plot, off,
                                  seasons[{ n, episodes[{ n, title, url, ext }] }] }]
iptvLines                … + mac, device
iptvSessions/{username}  ip, app, device, channel, kind, lastSeen, devices{}
iptvEvents               type, lineId, username, clientName, resellerId, ip, app, at
```

Series ka play id: `s1-2-5` = series 1, season 2, episode 5. Xtream app ko yehi `stream_id`
milta hai, aur `/series/<user>/<pass>/s1-2-5.mp4` isi par khulta hai.

---

## 6. Limits — saaf baat

- **Vercel functions** par 100–300 viewers theek chalte hain. 1000+ chahiye to Cloudflare Worker
  ya chhota relay (ya VPS) lazmi hai — serverless par egress aur duration limit lagti hai.
- Live TV ka source jitna stable hoga, utna hi "anti-freeze" behtar. Hum sirf proxy karte hain.
- 8 MB se bari M3U link import ek dafa mein nahi hoti (movies/series ke liye 16 MB) — hisson mein karein.
- Sirf woh content daalein jinke **rights** aap ke paas hain (FTA ya authorised).

---

## 7. Baqi (agla kaam)

1. **EPG har channel ke liye** — abhi `xmltv.php` khali guide deta hai; channel-wise EPG mapping chahiye.
2. **Ads kisi bhi channel par** — stream ke beech/pehle ad insert (abhi sirf free Live TV par).
3. **Public movies/series pages** — `/iptv` par movies/series browse, poster grid, trailer.
4. **Catch-up / 7-din archive**, aur **v41b billing engine** (auto 1–10 invoice + suspend).
5. **White-label apps** (Android TV / Fire TV, QR activation) — optional.

---

## 8. Test

```
node scripts/test-v43.mjs     # 82 checks
```
Poori chain: `npm test` (v39 se v43 tak), phir `npm run check` aur `npm run build:offline`.
