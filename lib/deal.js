import crypto from 'crypto';

// Signed tokens, so that a discount can never be invented in the browser.
//  - deal token: "product X may be sold Rs Y cheaper" (issued only by the assistant's server code, valid 3 hours)
//  - negotiation token: remembers how many times a shopper asked for a lower price on each product (so insisting really counts)
// The secret is DEAL_SECRET if you set it, otherwise it is derived from your Firebase private key (never sent anywhere).
const secret = () => crypto.createHash('sha256').update(`mz-deal|${process.env.DEAL_SECRET || process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_PRIVATE_KEY || process.env.GEMINI_API_KEY || 'mizanora'}`).digest();
const mac = (body) => crypto.createHmac('sha256', secret()).update(body).digest('base64url');

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${mac(body)}`;
}
function verify(token) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    const want = Buffer.from(mac(body));
    const got = Buffer.from(sig);
    if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return p && p.exp && Date.now() < p.exp ? p : null;
  } catch { return null; }
}

export const DEAL_TTL_MS = 3 * 60 * 60 * 1000;
export const DEAL_MAX_QTY = 5; // a deal price is valid for up to 5 pieces of that product

export const makeDeal = (pid, off) => sign({ t: 'deal', pid, off, exp: Date.now() + DEAL_TTL_MS });
// Rupees off per piece when the token is genuine, for this product and not expired. Otherwise 0.
export function dealOff(token, pid) {
  const p = verify(token);
  return p && p.t === 'deal' && p.pid === String(pid) ? Math.max(0, Math.min(1000, Math.floor(Number(p.off)) || 0)) : 0;
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
export function priceDeal(price, asks, cfg, cost) {
  let cap = Math.min(cfg.maxOff, Math.floor((price * cfg.maxPct) / 100));
  if (cost && cost > 0) cap = Math.min(cap, price - cost - 50);
  cap = Math.floor(Math.max(0, cap) / 10) * 10;
  if (cap < 10) return { granted: false, reason: 'no_room', off: 0 };
  if (asks < cfg.insistAfter) return { granted: false, reason: 'too_early', off: 0 };
  const final = asks >= cfg.insistAfter + 1;
  const off = final ? cap : Math.max(10, Math.floor(cap / 2 / 10) * 10);
  return { granted: true, off, final, newPrice: price - off };
}
