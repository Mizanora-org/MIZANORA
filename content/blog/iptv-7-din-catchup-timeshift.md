---
title: 7-din catch-up: chala hua programme dobara kaise dekhein
slug: iptv-7-din-catchup-timeshift
description: IPTV catch-up (timeshift) ka poora guide — kaun se channels par 7 din ka archive hota hai, Xtream apps mein timeshift icon kahan hai, aur ghalti hone par kya check karein.
date: 2026-11-02
category: live-and-reels
tags: iptv, catch-up, timeshift, archive, tv guide, mizanora
---

Match aadha reh gaya, ya koi programme miss ho gaya? IPTV ka sab se kaam ki feature yahi hai: **catch-up** — pichhle 7 din ka programme dobara chalana.

Mizanora par jin channels ka archive hai, unke liye 7 din tak catch-up chalta hai. Guide mein un channels par **7d** badge dikhta hai: `/iptv/guide`

## Catch-up kya hota hai

Live TV sirf "abhi" dikhata hai. Catch-up (ya timeshift) aap ko waqt peeche le jata hai — usi channel ka wohi programme, usi waqt se, jaise aap ne record kar liya ho.

Do cheezein chahiye:

1. **Archive** — server ke paas pichhle dinon ki recording available ho
2. **App support** — app timeshift ka tareeqa samajhti ho

Dono na hon to button dikhega hi nahi.

## Kaun se channels par milta hai

Har channel par nahi. Archive provider aur channel dono par depend karta hai. Asar yeh hai:

- News aur sports channels par aksar archive hota hai
- Local channels par kam
- Movie channels par aksar nahi (kyunki movie library alag hai)

Mizanora mein har channel ke sath `archive` set hota hai. Admin ya import yeh value bharta hai, aur gateway usi hisab se app ko batata hai ke channel par catch-up hai ya nahi.

## Apps mein timeshift kahan hai

**TiviMate:** channel par long-press → **Catch-up** ya EPG mein pichhle programme par click. Jo programmes grey nahi hain, woh chal jayenge.

**IPTV Smarters:** EPG list mein pichhli entry par tap → Play catch-up.

**MAG / Stalker box:** guide mein peeche scroll karein — archive wale channels par pichhle programmes highlight milte hain.

**Browser player:** filhaal live aur now/next; catch-up ke liye app behtar hai.

## Andar ka raasta

Xtream clients yeh path maangte hain:

```
/timeshift/<username>/<password>/<minutes>/<YYYY-MM-DD:HH-MM>/<channel>.ts
```

Mizanora is path ko seedha handle karta hai. Channel ka asli archive URL client ko kabhi nahi dikhta — playlist ke andar ke har piece `/api/gw/s?t=...` sealed link se guzarte hain, jo 3 ghante mein khud expire ho jate hain.

Iska matlab: catch-up link copy karke kisi aur ko bhejna bekar hai. Us mein aap ki line ka token hota hai, aur device limit bhi lagti hai.

## Kitna purana chal sakta hai

- **Maximum 7 din** — is se purana programme available nahi
- **Aik request mein 3 ghante tak** — poora din ek saath nahi
- **Future nahi** — sirf chala hua programme

Yeh limits server par lagti hain, app par nahi. Is liye "10 din pehle ka" maangne par error aata hai, chahe app kuch bhi dikhaye.

## Kaam na kare to

1. **Channel par archive hai?** Guide mein `7d` badge dekhein. Nahi hai to feature us channel par nahi.
2. **App purani hai?** TiviMate aur Smarters ki latest version use karein.
3. **Time zone** — EPG offset ghalat ho to app ghalat waqt maangti hai. Offset `0` karein (guide already Pakistan time mein hai).
4. **Line ki device limit** — catch-up bhi ek connection ginta hai. Do devices par saath chalane se error aa sakta hai.
5. **Programme abhi khatam hua** — 1 minute intezar karein, archive foran tayyar nahi hota.

## Catch-up vs recording

- **Catch-up** — server par pehle se maujood, koi storage nahi, 7 din ki hadd
- **Recording** — aap ke device par, jab tak storage hai

Catch-up sasta aur aasan hai. Recording tab chahiye jab programme 7 din se purana ho ya aap offline dekhna chahein.

## Aakhir mein

Catch-up un logon ke liye best hai jo live nahi dekh sakte — night shift wale, ya jin ka match office ke waqt hota hai. Guide mein `7d` badge dekhein, programme par click karein, ho gaya.

Guide: **/iptv/guide** · Apps setup: **/iptv/apps** · Trial: **/iptv/start**
