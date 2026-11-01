---
title: ACP, AP2, TAP, UCP: The AI Shopping Protocols Explained in Plain English
slug: ai-agent-payment-protocols-acp-ap2-ucp-explained
description: Six standards now let an AI agent prove who authorised a purchase and pay for it. What each one does, who backs it, and why a Pakistani shop owner should know the names.
date: 2026-10-31
category: earning-and-business
tags: ai, protocols, acp, ap2, ucp, payments, 2026, news
---

If you read one article about AI in commerce this year, you will run into a wall of four-letter acronyms: ACP, AP2, TAP, UCP, MPP, AMP. They sound like alphabet soup. They are actually the reason agentic shopping became real in 2026 rather than staying a demo.

Here is each one in plain English, with who is behind it and why it exists.

## The problem they all solve

An AI agent that wants to buy something on your behalf faces three questions that a human never has to answer:

1. **Did a real person actually authorise this purchase?**
2. **Is this agent a legitimate buyer, or a scraper pretending to be one?**
3. **How does the money move, and who is liable if it goes wrong?**

Every protocol below answers one or more of those. None of them makes the agent smarter — they make it *trustworthy enough to be allowed to transact*.

## The six that matter

| Protocol | Backed by | What it solves | Since |
| --- | --- | --- | --- |
| **ACP** — Agentic Commerce Protocol | OpenAI and Stripe | Completing checkout inside an AI assistant | Sept 2025 |
| **AP2** — Agent Payments Protocol | Google, donated to the FIDO Alliance | Cryptographically signed "mandates" proving a human authorised the exact purchase | Sept 2025 |
| **TAP** — Trusted Agent Protocol | Visa | Lets a merchant verify an inbound agent is a legitimate buyer, not a bot | Oct 2025 |
| **Agent Pay** | Mastercard | Tokenised card credentials scoped to a single agent, so disputes trace back to it | Apr 2025 |
| **MPP** — Machine Payments Protocol | Stripe and Tempo | Machine-to-machine payments, including stablecoins | Mar 2026 |
| **UCP** — Universal Commerce Protocol | Emerging open standard | Lets agents read product, delivery and returns data consistently across merchants | 2026 |

Compiled from published industry round-ups of the 2026 protocol stack ([Entagl, 2026](https://www.entagl.com/blog/agentic-commerce-2026-ai-shopping-agents); [nShift, 2026](https://nshift.com/blog/agentic-commerce-ai-shopping-agents-2026); [Braze, 2026](https://www.braze.com/resources/articles/agentic-commerce)).

## The one that matters most to a small merchant: UCP

Five of those six are about money. They matter to banks, card networks and the big AI platforms.

**UCP is the one that matters to you**, because it is about data. It aims to let an agent read your catalogue, your delivery options and your returns policy in a structured, comparable way — without a custom integration for every shop.

That has a direct consequence, and it is worth stating bluntly:

> If an agent cannot read your delivery terms, it will skip your offer — and no human will ever know you were passed over.

This is why "make your facts machine-readable" is the single highest-value piece of agentic-commerce advice for a small shop. It is also free. The reasoning is spelled out in [what agentic commerce means for Pakistani shops](/blog/agentic-commerce-2026-what-it-means-for-pakistani-shops).

## What none of them fix

It is worth naming the gaps, because the marketing around this subject is loud:

- **They do not create trust.** Only about 10% of consumers are willing to let an agent shop without oversight, even as adoption climbs ([Braze, 2026](https://www.braze.com/resources/articles/agentic-commerce)). Protocols secure the transaction; they do not make the shopper comfortable.
- **They do not cover cash on delivery.** Every one of these assumes a digital payment rail. In Pakistan, roughly 94.5% of online orders were cash on delivery across ~170,000 orders in 2025–26 ([OrderNation, 2026](https://www.ordernation.com/blogs/research/state-of-online-shopping-pakistan-2026)). The protocol stack currently has nothing to say about the dominant payment method in this country.
- **They do not fix bad data.** A protocol can transmit a fact perfectly and still transmit the wrong fact. If your size chart is wrong, an agent will confidently buy the wrong size.

## So what should a Pakistani shop actually do?

Three things, in this order:

1. **Publish complete, structured product facts** — price, delivery fee, delivery window, return window, sizes, materials. This is UCP-readiness, and it helps human customers today.
2. **Keep delivery promises honest.** Under agentic commerce, delivery accuracy becomes a *selection* signal, not just a service metric.
3. **Do not rebuild anything yet.** The standards are still moving, and several compete. Being legible is the durable investment; betting on one protocol is not.

This is the same discipline as [the zero-quota theory](/blog/zero-quota-theory-systems-that-survive-free-limits): build the layer that stays true regardless of which vendor wins.

## The short version

The protocols turned "an AI could buy this for you" into "an AI can prove it was allowed to". That is a genuinely large change — for the countries where people pay digitally. For Pakistan, the interesting layer is the data one, and preparing for it costs nothing but accuracy.

{{cta}}
