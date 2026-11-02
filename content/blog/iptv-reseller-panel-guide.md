---
title: Reseller panel kaise chalayein: client banane se wasooli tak
slug: iptv-reseller-panel-guide
description: Mizanora IPTV reseller panel ka poora tour — naya client banana, price set karna, renewal, suspend, credit aur 1–10 ki wasooli. Roman Urdu mein step by step.
date: 2026-11-02
category: earning-and-business
tags: iptv reseller, panel, dashboard, clients, credit, collection, mizanora
---

Panel ka maqsad aik hi hai: **kam se kam click mein client ko line dena**. Yeh guide usi tarteeb mein hai jis tarteeb mein kaam hota hai — approve se wasooli tak.

## 1. Panel kholein

`mizanora.vercel.app/reseller` par jayein aur **wohi Mizanora account** use karein jis se application bheji thi. Admin approve karta hai, phir yeh page aap ka dashboard ban jata hai.

Pehli dafa kya dikhega:

| Hissa | Matlab |
|---|---|
| **Clients** | aap ke banaye hue clients |
| **Active lines** | jo is waqt chal rahi hain |
| **Client se / mahina** | sab clients ka total monthly |
| **Aap ka munafa** | total minus Rs 100 per line |
| **Credit** | kitni lines aur bana sakte hain |

## 2. Naya client banayein

**Naya client** → form bharein:

1. **Naam** — client ka poora naam
2. **WhatsApp number** — isi par credentials bhejne hain
3. **Email (optional)** — agar client ka Mizanora account hai to line us par bandh jati hai aur `/account/iptv` par nazar aati hai
4. **Plan** — Starter (1 device) / Family (2) / Premium (3)
5. **Mahine** — 1, 3 ya 12
6. **Price per month** — Rs 100 se Rs 200 ke darmiyan

Form ke neeche live hisaab dikhta hai: client se kitna, Mizanora ko kitna, aap ka kitna. **Line banayein** dabayein.

## 3. Credentials bhejein

Line bante hi screen par server, username, password aur (MAG ke liye) MAC aa jata hai:

- **Poora message copy** — message tayyar hai, bas paste karna hai
- **WhatsApp par bhejein** — client ke number par seedha khul jata hai

Credentials sirf client ko dein. Password share karne se line block ho sakti hai (device limit server par lagti hai).

## 4. Price ka usool

- Aap apni price khud rakhte hain, **cap Rs 200** hai — system is se zyada allow nahi karta
- **Purane clients ka rate kabhi nahi badalta** — price sirf naye clients par lagti hai
- Rs 100 se kam bechna aap ka nuqsan hai (Mizanora ko utna hi dena hai)

## 5. Har mahine ka kaam (1 se 10)

| Din | Kaam |
|---|---|
| 1 | Panel kholain, **expiring** list dekhein |
| 1–7 | Clients ko WhatsApp reminder (template panel mein mojood) |
| 1–10 | Apne JazzCash/Easypaisa/bank par wasooli |
| 10 tak | Mizanora ko Rs 100 per line (JazzCash 0306-2015326) |
| 12 | Jo pay nahi kiya, unki line suspend ho jati hai |

Payment aane par client ki line par **+1m** dabayein — expiry barh jati hai, line foran chalu.

## 6. Suspend aur resume

- **Ban** icon — line band (client non-payment par)
- **Play** icon — line chalu (agar expiry baqi hai)

Suspend karne se line ka data nahi mitta — payment ke baad wohi credentials chalti hain.

## 7. Credit

Credit = kitni lines bana sakte hain. Naya reseller 10 lines se shuru karta hai. Barhana ho to WhatsApp par batayein — admin panel se **+10 credit** karta hai. Credit khatam ho to form error dega (client adhoora nahi banta).

## 8. Payment number set karna

**Settings** → JazzCash / Easypaisa / Bank / Account ka naam → **Payment save**.
Client ko recharge screen par yahi number aur naam dikhta hai — is liye galat number na chhorein.

## Aam ghaltiyan

- Client ka number galat daalna → credentials kisi aur ko chale jate hain
- Rs 250 charge karna → system cap kar deta hai, client ko 200 hi dikhta hai
- Payment ke baghair line chalu chhorna → aap Mizanora ko pay karte hain, client aap ko nahi
- Email galat → line account se nahi judti (magar chalti rehti hai)

## Aage

- [Reseller ka poora hisaab](/blog/iptv-reseller-pakistan-guide)
- [Reseller program](/iptv/reseller) · [Panel kholein](/reseller)
