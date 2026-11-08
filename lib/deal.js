import crypto from 'crypto';

// Signed tokens, so that a discount can never be invented in the browser.
//  - deal token: "product X may be sold Rs Y cheaper" (issued only by the assistant's server code, valid 3 hours)
//  - negotiation token: remembers how many times a shopper asked for a lower price on each product (so insisting really counts)
// Never use a known/public fallback: a forged token could discount any order by Rs 1,000 per item.
// In production set DEAL_SECRET; Firebase server credentials also provide a stable private fallback.
// A temporary per-process key keeps local development safe but tokens will not survive another worker/deploy.
const ephemeral = crypto.randomBytes(32).toString('hex');
const secret = () => crypto.createHash('sha256').update(`mz-deal|${process.env.DEAL_SECRET || process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_PRIVATE_KEY || ephemeral}`).digest();
const mac = (body) => crypto.createHmac('sha256', secret()).update(body).digest('base64url');

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${mac(body)}`;
}
function verify(token) {
  try {
    if (typeof token !== 'string' || token.length > 16384) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    if (!/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]{43}$/.test(sig)) return null;
    const want = Buffer.from(mac(body));
    const got = Buffer.from(sig);
    if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const now = Date.now();
    return p && Number.isSafeInteger(p.exp) && p.exp > now && p.exp <= now + DEAL_TTL_MS + 60_000 ? p : null;
  } catch { return null; }
}

export const DEAL_TTL_MS = 3 * 60 * 60 * 1000;
export const DEAL_MAX_QTY = 5; // a deal price is valid for up to 5 pieces of that product

export const makeDeal = (pid, off, shopPrice) => sign({ t: 'deal', pid, off, base: Math.round(Number(shopPrice) || 0), exp: Date.now() + DEAL_TTL_MS });
// Rupees off per piece when the token is genuine, for this product and not expired. Otherwise 0.
export function dealOff(token, pid, shopPrice) {
  const p = verify(token);
  const price = Math.round(Number(shopPrice) || 0);
  // If the authoritative price changed after the assistant made the deal, re-negotiate.
  // Otherwise a valid old-price token could make a newly discounted item cost Rs 1.
  if (!p || p.t !== 'deal' || p.pid !== String(pid) || !(price > 0) || p.base !== price) return 0;
  return Math.max(0, Math.min(1000, Math.floor(Number(p.off)) || 0));
}

export const makeNeg = (asks) => sign({ t: 'neg', asks, exp: Date.now() + DEAL_TTL_MS });
export function readNeg(token) {
  const p = verify(token);
  return p && p.t === 'neg' && p.asks && typeof p.asks === 'object' ? p.asks : {};
}

// THE RULE (decided here, never by the AI):
//  - the first (insistAfter - 1) requests: no discount (the assistant politely holds the price)
//  - request number insistAfter: half of the allowed discount
//  - the next request: the full allowed discount, and that is final
// Allowed discount = smallest of: admin "max Rs off", admin "max % of price", and what keeps Rs 50 profit (when the cost is known).
export function priceDeal(price, asks, cfg, cost, room = null) {
  let cap = Math.min(cfg.maxOff, Math.floor((price * cfg.maxPct) / 100));
  if (cost && cost > 0) cap = Math.min(cap, price - cost - 50);
  if (room !== null && room !== undefined && Number.isFinite(Number(room))) cap = Math.min(cap, Number(room)); // imported products carry their own room (profit minus Rs 50), so archived products can never be sold under cost
  cap = Math.floor(Math.max(0, cap) / 10) * 10;
  if (cap < 10) return { granted: false, reason: 'no_room', off: 0 };
  if (asks < cfg.insistAfter) return { granted: false, reason: 'too_early', off: 0 };
  const final = asks >= cfg.insistAfter + 1;
  const off = final ? cap : Math.max(10, Math.floor(cap / 2 / 10) * 10);
  return { granted: true, off, final, newPrice: price - off };
}
