---
title: The Urdu-First Theory: Why Muaaz Iqbal Builds for Roman Urdu Before English
slug: urdu-first-design-theory-technology-in-your-own-language
description: Most Pakistani software is English-first. Muaaz Iqbal argues the opposite: design in the language the user thinks in. How that shaped Noor, Asaan Lang and all of Mizanora.
date: 2026-10-31
category: muaaz-iqbal
tags: theory, urdu, roman urdu, asaan lang, noor, language, pakistan
image: /img/muaaz/muaaz-iqbal-07.jpg
---

Here is a fact that explains most of Mizanora: a shopper in Kasur who wants to ask "kurti dikhao" will not type "show me women's kurtis". They will not switch to English, they will not guess the spelling, and they will not read a help centre article. They will close the app.

![Muaaz Iqbal, creator of Asaan Lang and Mizanora](/img/muaaz/muaaz-iqbal-07.jpg "The Urdu-First Theory: build in the language people think in")

Muaaz Iqbal's answer is the **Urdu-first theory**, and it is stated very simply:

> The user's first language is not a translation layer you add at the end. It is the starting point of the design.

## Why English-first fails here

English-first products make three quiet assumptions that break in Pakistan:

1. **The user reads English comfortably.** Many read it, far fewer think in it, and almost nobody speaks it at home.
2. **The user will learn your words.** They will not. They will leave.
3. **Typing is easy.** Roman Urdu is typed phonetically and differently by everyone: *kurti*, *kurty*, *qurti*. A strict matcher rejects all but one spelling.

Designing around those three facts changes everything downstream.

## What Urdu-first produced

**Noor, the shopping assistant.** Noor takes voice in Urdu and Roman Urdu and answers in both. That is not a feature bolted onto a chatbot — the product was designed around the microphone, because the microphone is how a person who is not confident in English asks a question. Read [how Noor works](/blog/mizanora-ai-assistant-noor-urdu-voice-shopping) and [our guide to voice search](/blog/voice-search-and-smart-search-shopping-guide).

**Asaan Lang.** If the theory is right, it should apply to programming as well, so Muaaz built a language whose keywords are Urdu and Roman Urdu: `likho`, `agar`, `warna`, `har`, `kaam`. Errors arrive in Roman Urdu with the line number. You can read [what Asaan Lang is](/blog/asaan-lang-urdu-programming-language-by-muaaz-iqbal) or jump into [eight examples for beginners](/blog/learn-coding-in-urdu-asaan-lang-examples-for-beginners).

**The search box.** Mizanora's search is deliberately forgiving about Roman-Urdu spelling, because punishing a shopper for spelling *kurti* differently is punishing them for being Pakistani.

## Three practical rules you can steal

- **Answer in the language of the question.** If someone writes in Roman Urdu, do not reply in English because your template was written in English.
- **Accept every plausible spelling.** Normalise before you match: strip vowels, fold `q/k`, `y/ee`, `z/j`. It is twenty lines of code and it doubles how many people your search understands.
- **Speak it, don't just write it.** A voice answer reaches people whose reading is weaker than their listening. That is a huge share of any real population.

## The honest counter-argument

Urdu-first is not free. There is far less training data. Fonts and rendering are fiddly. Roman Urdu has no standard spelling, so you must test with real users rather than with a dictionary. And English remains the language of the code itself — Muaaz writes JavaScript, not Asaan Lang, to build the shop.

The theory is about the **user's** language, not the developer's. Confusing the two is where most attempts at localisation go wrong.

## The bigger claim

Muaaz would put it like this: a country where most people do not think in English cannot build its digital economy in English. The shops and tools that win here will be the ones that start from the sentence a person actually says out loud — *mujhe ek achi winter jacket chahiye* — and work backwards from there.

Continue with [the AI orchestra theory](/blog/ai-orchestra-theory-claude-gemini-qwen-chatgpt-together), [the Mizan mindset](/blog/muaaz-iqbal-mizan-mindset-balance-theory) and [who Muaaz Iqbal is](/blog/who-is-muaaz-iqbal-founder-of-mizanora).

{{cta}}
