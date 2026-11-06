---
title: "Ek banda, chaar AI: Claude, Gemini, Qwen aur ChatGPT se kaam karwane ka tareeqa"
slug: ai-orchestration-multiple-models-workflow
description: AI orchestration ka practical tareeqa: kaun sa model kis kaam par, output ko kaise verify karein, aur AI se banaya hua code production mein kaise bhejein. Mizanora aur HijriAnchor isi workflow se bane hain.
date: 2026-11-06
category: technology
tags: ai, orchestration, claude, gemini, qwen, chatgpt, workflow, muaaz-iqbal, nextjs
image: /img/muaaz/muaaz-iqbal-07.jpg
---

"AI se website ban gayi" — yeh jumla aadha sach hai. AI code likh deta hai, magar **jawab ki
zimmedari** aap ki rehti hai. Mizanora jaisa project (shopping + movies + songs + Quran + live TV)
isi liye ek hi model se nahi bana; woh **chaar models ke workflow** se bana hai.

## Model ka kaam, banda ka kaam

| Kaam | Kaun karta hai |
| --- | --- |
| Plan banana, architecture | Banda + Claude |
| Bara code likhna / refactor | Claude |
| UI copy, Urdu/Roman Urdu zaban | Gemini |
| Data cleaning, CSV, scraping logic | Qwen |
| Review, test cases, "kya tootega?" | ChatGPT |
| Verify, deploy, rollback | **Sirf banda** |

Asal farq yahan hai: AI se **plan** lo, phir har step ko **test** se verify karo. Mizanora mein
`npm run check` (syntax + undefined names), `npm test` (hundreds of checks) aur `npm run build`
teen darwaze hain — jo teeno se guzre wohi deploy hota hai.

## 5 asool jo kaam karte hain

### 1. Ek prompt = ek kaam
"Poori website banao" bekar prompt hai. "Is file ka yeh function is tarah likho, aur yeh test pass
karo" — yeh kaam karta hai. Chhote prompts ka nateeja bara hota hai.

### 2. Har jawab ka diff dekho
AI ka code seedha paste karna khatra hai. Diff dekho: kya import add hua, kya purana behaviour
badla, kya `try/catch` hat gaya. Mizanora mein ek dafa AI ne `catch` hata diya tha aur poora page
500 dene laga — diff dekhne se pakra gaya.

### 3. Model badlo, jawab milao
Ek hi sawal do models se poocho. Jahan dono ka jawab **same** ho, wahan bharosa zyada. Jahan
mukhtalif ho, wahan test likho — test faisla kar dega.

### 4. Test pehle, feature baad mein
"Yeh cheez tootni nahi chahiye" ko test mein likho. Mizanora ke `scripts/test-v55.mjs` mein
123 checks hain — sirf is liye ke agla change purani cheez na tore.

### 5. AI ko context do, guess na karne do
AI ko repo ke asli files, asli error, aur asli data do. "Mere paas ek error hai" se model andaza
lagata hai; error ka poora text dene se woh **fix** karta hai.

## AI se jo nahi karwana chahiye

- **Secrets:** API keys, service account JSON — kabhi chat mein na daalein.
- **Legal faislay:** kis cheez ki ijazat hai, yeh aap ka kaam hai.
- **User ka data:** asli customers ke naam/phone AI ko na dein.
- **"Sab kuch ek dafa"** wala refactor: pehle chhota hissa, phir agla.

## Mizanora mein AI kahan hai

- **Urdu assistant**: shopper se Urdu/Roman Urdu mein baat karta hai aur products dhoondta hai.
- **Search suggestions**: jo log dhoondte hain magar nahi milta, woh list admin ko jati hai (isse
  catalogue behtar hota hai).
- **Content**: blog guides ka draft, phir insani review.

AI ka kaam **speed** hai; faisla insaan ka. Isi liye Mizanora ke har page par ek "verify" ka rasta
maujood hai — admin panel, `/api/health`, aur tests.

## Shuru karne ke liye chhota plan

1. Ek kaam chuno (maslan: "product page par delivery estimate").
2. Model se plan maango, 5-10 line ka.
3. Sirf ek file ka change maango.
4. Test likho jo purana behaviour bachaye.
5. Deploy, phir agla kaam.

Yeh cycle chhoti hai, is liye ghalti bhi chhoti hoti hai. Bari "AI website" wahin se banti hai.

Aage padhein: [Muaaz Iqbal profile](/muaaz-iqbal) · [Mizanora kaise bana](/blog/muaaz-iqbal-kasur-developer-story) · [sab articles](/blog/author/muaaz-iqbal).
