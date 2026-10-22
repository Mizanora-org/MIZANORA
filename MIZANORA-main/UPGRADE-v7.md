# Mizanora v7 upgrade notes

## Smooth / no-hang
- /products draws 24 cards first, then more while scrolling (IntersectionObserver + "Show more"). Big catalogues no longer freeze weak phones.
- Search box uses `useDeferredValue`: typing stays instant, matching runs right after.
- Pinch-zoom enabled again (was blocked: accessibility and Lighthouse penalty).

## New features
1. **Voice search** (Urdu / English, mic in header search and /products). Free, browser built-in; hidden if unsupported.
2. **Urdu-script search**: type or speak "لال سوٹ ۲۰۰۰ سے کم". Urdu digits and "2 hazar" also understood.
3. **Prepaid payments** (Easypaisa, JazzCash, Bank/Raast) + optional prepaid discount. Set env vars in `.env.example`. COD stays default. Customer sends money, enters TID; admin sees a yellow "check TID before dispatch" line on the order. Server recomputes the discount (never trusts the browser). Why: COD return-to-origin in Pakistan is reported at 25-30%.
4. **AI-agent ready store** (agentic commerce, 2026-2030): `/llms.txt` and `/catalog.json` give ChatGPT/Gemini/Perplexity-style shopping agents clean data (price, stock, options, policies). Payment methods are also in the Organization JSON-LD.

## Checks
`node scripts/check.js` and `node scripts/typecheck.js` both pass (153 files). A full `next build` was not run here (no network), so run `npm run build` once before deploying.

## Next (roadmap 2026-2030)
Compare products, back-in-stock WhatsApp alerts, flash-sale countdowns, loyalty points/referral wallet, live-shopping rooms (reels already exist), BNPL partner, automatic Raast QR / gateway confirmation, AR/size try-on.
