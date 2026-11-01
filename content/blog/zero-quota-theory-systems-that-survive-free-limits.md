---
title: The Zero-Quota Theory: Build So the Shop Still Works When the Free Limit Runs Out
slug: zero-quota-theory-systems-that-survive-free-limits
description: Muaaz Iqbal's engineering rule for Mizanora: assume every free tier will run out, every API will fail, and every host will go down. Then design so the customer never notices.
date: 2026-11-01
category: muaaz-iqbal
tags: theory, engineering, resilience, free tier, muaaz iqbal, architecture
image: /img/muaaz/muaaz-iqbal-06.jpg
---

Every young founder hits the same wall. The database has a free limit. The image host has a bandwidth cap. The AI API has a monthly quota. The day the limit is reached, the product dies in front of the customer — and the customer does not care whose fault it is.

![Muaaz Iqbal, developer of Mizanora, Kasur Punjab Pakistan](/img/muaaz/muaaz-iqbal-06.jpg "The Zero-Quota Theory: design for the day the free tier ends")

Muaaz Iqbal's answer is what he calls the **zero-quota theory**, and it is the reason Mizanora has stayed online through months when the free tiers were exhausted.

## The rule

> For every paid or limited thing the product depends on, there must be a path that works when that thing is gone. The path may be worse. It must never be empty.

That last sentence is the important one. Most fallback design stops at "show an error". The zero-quota theory says an error is a failure of imagination: there is almost always a slower, dumber, local answer that still serves the customer.

## How it looks inside Mizanora

| The limited thing | What happens when it runs out | What the customer sees |
| --- | --- | --- |
| Firestore reads | The catalogue is read from JSON files on disk (`data/catalog/`) | The shop, unchanged |
| The GitHub API (for the [live GitHub section](/muaaz-iqbal)) | A curated fallback list is rendered with a `CACHED` badge | Real repos, honestly labelled |
| The image optimizer | Photos load straight from their own host | Photos, unchanged |
| Firebase is unreachable | Public REST fallback, then a static list | Still a working page |

None of this is exotic. It is the discipline of asking "and then what?" three times for every external call — which is exactly what Muaaz does because he has lived through the alternative.

## Why this is a business theory, not just a coding one

Free tiers are a business model, not a gift. A platform gives you a free limit so that you build on it and later pay. If your product cannot survive the day the invoice arrives, you did not get a free tier — you got a lease on somebody else's terms.

The zero-quota theory turns that around:

1. **Build the cheap path first.** Files on disk beat a database you have not paid for yet.
2. **Add the expensive path as an upgrade, never as a dependency.** If it disappears, you lose speed, not the shop.
3. **Label the degraded state honestly.** The `CACHED` badge on the GitHub list is a small thing, but it is the whole theory in one word: never invent, never hide.
4. **Test the broken version on purpose.** If you have never seen your product with the API switched off, you do not know what your customers see.

## The part people get wrong

A fallback is not the same as a lie. When GitHub is unreachable, the page says so. When a product photo stops loading, the product is hidden rather than replaced with a placeholder that pretends to be a picture. The [trust-first theory](/blog/trust-first-theory-why-mizanora-shows-real-prices) covers the same ground from the customer's side.

> A shop that shows a broken image is annoying. A shop that shows a *different* image is dishonest.

## Use it this week

Pick the one external service your own work depends on most. Write down what your product does the day it returns a 429. If the answer is "it breaks", you have found your next weekend.

Related: [the Mizan mindset](/blog/muaaz-iqbal-mizan-mindset-balance-theory), [how Mizanora was built](/blog/muaaz-iqbal-story-how-mizanora-was-built) and [what Muaaz actually built](/blog/muaaz-iqbal-projects-mizanora-hijrianchor-muslim-islam-organization).

{{cta}}
