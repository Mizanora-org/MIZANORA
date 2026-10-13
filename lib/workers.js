// Mizanora Worker (affiliate) Program: the rules in ONE place. Used by the server, the worker dashboard and the admin.
// Edit the numbers here to change rates, price limits or how fast a worker moves up.

// rate = commission % of the product price (the shop price, before any worker markup)
// maxPrice = highest product price (Rs, per piece) a worker of this level can earn commission on. 0 = no limit.
// needs = what the worker must have to reach this level (delivered orders and delivery rate in %).
export const TIERS = [
  { key: 'starter',  name: 'Starter',  rate: 10, maxPrice: 1500,  needs: { delivered: 0,   rate: 0 },  custom: false },
  { key: 'silver',   name: 'Silver',   rate: 20, maxPrice: 3000,  needs: { delivered: 10,  rate: 70 }, custom: false },
  { key: 'gold',     name: 'Gold',     rate: 30, maxPrice: 8000,  needs: { delivered: 40,  rate: 75 }, custom: false },
  { key: 'platinum', name: 'Platinum', rate: 40, maxPrice: 20000, needs: { delivered: 120, rate: 80 }, custom: false },
  { key: 'elite',    name: 'Elite',    rate: 50, maxPrice: 0,     needs: { delivered: 300, rate: 85 }, custom: true },
];

export const MIN_PAYOUT = 500;          // Rs: smallest payout a worker can request
export const MAX_MARKUP_PCT = 50;       // Elite workers can add at most this % of the shop price as their own profit
export const REF_DAYS = 30;             // a visitor's link stays linked to the worker for this many days

export const tierByKey = (k) => TIERS.find((t) => t.key === k) || TIERS[0];

export const deliveryRate = (s = {}) => {
  const done = (Number(s.delivered) || 0) + (Number(s.returned) || 0) + (Number(s.cancelled) || 0);
  return done ? Math.round(((Number(s.delivered) || 0) / done) * 100) : 0;
};

// The level a worker has EARNED from real numbers (highest level whose conditions are all met).
export function earnedTier(stats = {}) {
  const d = Number(stats.delivered) || 0, r = deliveryRate(stats);
  let t = TIERS[0];
  for (const x of TIERS) if (d >= x.needs.delivered && r >= x.needs.rate) t = x;
  return t;
}

// What the worker actually gets: the admin can override the level, the rate, or allow custom pricing for one worker.
export function effectiveTier(w = {}) {
  const base = tierByKey(w.tierKey);
  const rate = Number(w.rateOverride) > 0 ? Math.min(50, Number(w.rateOverride)) : base.rate;
  return { ...base, rate, custom: base.custom || Boolean(w.customAllowed) };
}

export const eligible = (tier, price) => !tier.maxPrice || Number(price) <= tier.maxPrice;

// Commission for one cart line. `price` is the SHOP price; `markup` is the Elite worker's own extra profit per piece.
export function lineEarning(tier, price, qty, markup = 0) {
  const ok = eligible(tier, price);
  const commission = ok ? Math.floor((Number(price) * Number(qty) * tier.rate) / 100) : 0;
  const markupProfit = tier.custom ? Math.max(0, Math.floor(Number(markup) || 0)) * Number(qty) : 0;
  return { ok, commission, markupProfit, total: commission + markupProfit };
}

export const cleanWorkerCode = (raw) => String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14);

// 12345-1234567-1 or 1234512345671
export const cnicDigits = (raw) => String(raw || '').replace(/\D/g, '');
export const validCnic = (raw) => cnicDigits(raw).length === 13;

export const commissionState = (orderStatus) => (orderStatus === 'Delivered' ? 'approved' : orderStatus === 'Cancelled' || orderStatus === 'Returned' ? 'cancelled' : 'pending');
