---
title: How to Put BarakatWave TV Channels Into Mizanora Live TV (Xtream Codes, Step by Step)
slug: barakatwave-tv-xtream-codes-setup-guide
description: Mizanora Live TV can now read an Xtream Codes panel directly. Get your free BarakatWave server, then import live channels, movies or series into the shop in about two minutes.
date: 2026-10-28
category: live-and-reels
tags: barakatwave, xtream codes, live tv, iptv, mizanora, guide, streaming
---

Mizanora Live TV used to accept only M3U playlists. It now speaks **Xtream Codes** too — the login system every IPTV panel uses — which means a channel list can be pulled straight from a server with a username and a password.

This guide walks through it using **BarakatWave TV**, Muaaz Iqbal's own broadcast platform, which gives every signed-in user a free personal Xtream server.

![Muaaz Iqbal, founder of BarakatWave TV and Mizanora](/img/muaaz/muaaz-iqbal-07.jpg "BarakatWave TV: connect an Xtream Codes panel to Mizanora Live TV")

## Step 1 — Get your Xtream credentials

1. Open [barakatwave.vercel.app](https://barakatwave.vercel.app).
2. Sign in with Google or Gmail.
3. Press **Generate My Free Xtream Server** (once — it is permanent).
4. Copy the three things it shows you:
   - **Server URL** — `https://barakatwave.vercel.app`
   - **Username**
   - **Password**

BarakatWave also gives you an M3U Plus link and an XMLTV EPG URL on the same screen. Those are useful in VLC, Kodi and smart TVs, but Mizanora does not need them — it reads the panel directly.

## Step 2 — Put them into Mizanora

1. In the shop, open **Admin → Live TV**.
2. Scroll to **Connect an Xtream Codes panel**.
3. Fill in the three fields and press **Test connection**.

Within a second or two you should see:

- the account status and how many connections are in use,
- how many live channels the panel is offering,
- the list of groups (Pakistan, Islamic, News, Drama & Entertainment, Movies & Sports…).

Nothing has been saved yet. Test only reads.

## Step 3 — Choose what to import

- **Live TV / Movies / Series** — pick which one you want.
- **Groups** — tap the groups you want, or leave it empty for everything. If you only want Pakistani and Islamic channels, select just those two; a smaller list loads faster and is easier for visitors to browse.
- **HLS (.m3u8)** — leave this on unless you know your player needs `.ts`.

Then press **Import**. The channels appear in the editor below, exactly as if you had pasted a playlist.

## Step 4 — Check, then save

1. Press **Check all channels** and let it finish. Anything dead is marked with a red dot.
2. Press **Save**. `/live` updates within a few seconds.

## Good habits

- **Import less than you think you need.** Twenty channels people watch beat four hundred nobody opens. A huge list is the main reason live TV feels slow.
- **Switch off the dead ones** rather than deleting them — you can turn them back on when the source returns.
- **Only add streams you have the right to show.** Your own, or ones whose owner allows it. You are responsible for what goes on your shop.
- **Re-run the check weekly.** Streams move.

## If it does not connect

| What you see | What it usually means |
| --- | --- |
| "not usable" under the server field | The address has a typo, or it includes a path — use the panel root only |
| "The panel refused this login" | Username or password wrong, or the account is not authorised yet |
| "did not answer with JSON" | The address is not an Xtream panel, or it is the portal page rather than the API root |
| "private or local" | You are pointing at a home or internal address; that is blocked on purpose |
| "EXPIRED" next to the status | The account's subscription date has passed |

## Why the browser cannot do this itself

IPTV panels almost always refuse cross-site requests, so a web page cannot read them directly. Mizanora's **server** makes the call instead, behind an admin login, with three safety rules: private and local addresses are refused, the answer is capped at 8 MB and 20 seconds, and redirects are not followed.

Your password is used for that one request, is never stored, is never written to a log, and is never sent back to the browser.

## The same credentials elsewhere

Xtream Codes is a standard, so one set of credentials works across apps:

- **IPTV Smarters Pro / TiviMate / XCIPTV / OTT Navigator** — choose "Login with Xtream Codes API"
- **VLC / Kodi** — use the M3U Plus link from BarakatWave
- **SIRAVEX** — the player side of the same ecosystem, see [the SIRAVEX guide](/blog/siravex-multi-view-iptv-player-guide)
- **Mizanora Live TV** — as above

More: [every Muaaz Iqbal project mapped](/blog/muaaz-iqbal-projects-map-2026), [live TV audio and quality](/blog/mizanora-live-tv-audio-tracks-video-quality) and [all channels, search and favourites](/blog/mizanora-live-tv-all-channels-search-favourites).

{cta}
