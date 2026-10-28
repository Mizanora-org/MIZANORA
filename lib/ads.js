// ============================================================================
// MIZANORA ADS API (v31) - shared model + optimisation engine
// ----------------------------------------------------------------------------
// Pure logic, shared by the admin API, the serve API and the admin panel:
//   * AD_TYPES / ANIM_PRESETS   - what an ad can be
//   * cleanAd / cleanStats      - safe shapes for what is stored in Firestore
//   * scoreAd / pickAds         - the AUTO-OPTIMISE engine (weighted by CTR)
//   * buildCreative / signToken - what the browser receives and how stats are protected
//
// THE ENGINE IN ONE LINE: every active ad gets a score from its click-through
// rate (with a freshness bonus so new ads get tested), and the slot picks ads
// by weighted random sampling - good ads show up more, bad ads fade out.
// ============================================================================

export const AD_TYPES = [
  { id: 'product', label: 'Product ad', icon: '🛍️', desc: 'A MIZANORA product card (photo, name, price, add-to-cart) shown on any website.' },
  { id: 'banner', label: 'Banner ad', icon: '🖼️', desc: 'A static picture banner with headline and a button.' },
  { id: 'video', label: 'Video ad', icon: '🎬', desc: 'An HTML5 video that plays automatically (muted), with a play button and a skip countdown.' },
  { id: 'animation', label: 'Animation ad', icon: '✨', desc: 'A lightweight CSS animation (float, shine, pulse, wave, marquee, spin, pop, gradient) with headline and button.' },
  { id: 'html', label: 'HTML creative', icon: '🧩', desc: 'Your own HTML for the creative. Scripts and event handlers are stripped by the server before it is stored.' },
];
export const AD_TYPE_IDS = AD_TYPES.map((t) => t.id);

// CSS animation presets for "animation" ads. The browser-side classes live in
// public/ads/embed.js and app/globals.css (mza-anim-*).
export const ANIM_PRESETS = [
  { id: 'float', label: 'Float up', desc: 'The creative gently rises and falls.' },
  { id: 'shine', label: 'Shining sweep', desc: 'A light sweep crosses the creative again and again.' },
  { id: 'pulse', label: 'Pulse', desc: 'A soft heartbeat scale on the whole creative.' },
  { id: 'wave', label: 'Wave', desc: 'A wave moves across the background.' },
  { id: 'marquee', label: 'Marquee', desc: 'The headline scrolls like a cinema banner.' },
  { id: 'spin', label: 'Spin', desc: 'A slow rotating badge or logo.' },
  { id: 'pop', label: 'Pop in', desc: 'Bounces in once, then stays (great for CTAs).' },
  { id: 'gradient', label: 'Living gradient', desc: 'The background gradient slowly moves.' },
];
export const ANIM_IDS = ANIM_PRESETS.map((a) => a.id);

export const DEFAULT_CONFIG = {
  enabled: true,        // the whole Ads API switch (off = nothing is served anywhere)
  autoOptimize: true,   // master auto-optimise switch (per-ad toggles still work)
  showOnShop: false,    // does the shop itself show ads? (home + deals pages, key=self)
  rotateMs: 8000,       // how long one ad stays before the next one rotates in a slot
  perView: 3,           // max ads in ONE slot request
  maxAdsPerKey: 6,      // max ads a key may request in one response
};

const txt = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const cleanUrl = (v) => {
  const s = String(v == null ? '' : v).trim().slice(0, 500);
  if (!s) return '';
  return /^(https?:)?\/\//i.test(s) || s.startsWith('/') ? s : `https://${s}`;
};

// -----------------------------------------------------------------------------
// SHAPING: everything that enters Firestore passes through here.
// -----------------------------------------------------------------------------
export function cleanAd(x = {}) {
  const type = AD_TYPE_IDS.includes(x.type) ? x.type : 'banner';
  const ad = {
    id: String(x.id || '').replace(/[^\w-]/g, '').slice(0, 60) || `a${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
    name: txt(x.name, 80) || 'Untitled ad',
    type,
    status: x.status === 'paused' ? 'paused' : 'active',
    // headline / sub / cta / href - used by every type
    headline: txt(x.headline, 120),
    sub: txt(x.sub, 200),
    cta: txt(x.cta, 40) || (type === 'product' ? 'Buy now' : 'Visit'),
    href: cleanUrl(x.href),
    // picture banner
    img: String(x.img || '').trim().slice(0, 500),
    bg: String(x.bg || '').trim().slice(0, 40),
    // animation
    anim: ANIM_IDS.includes(x.anim) ? x.anim : 'float',
    // video
    video: {
      url: String(x.videoUrl || '').trim().slice(0, 500),
      poster: String(x.poster || '').trim().slice(0, 500),
      muted: x.muted !== false,
      loop: x.loop !== false,
      skipAfter: Math.max(0, Math.min(30, Math.floor(Number(x.skipAfter)) || 5)),
    },
    // product ad snapshot (stored so no product read is needed at serve time)
    productId: String(x.productId || '').replace(/[^\w-]/g, '').slice(0, 80),
    product: x.product && typeof x.product === 'object' ? {
      name: txt(x.product.name, 140),
      price: Math.max(0, Math.floor(Number(x.product.price) || 0)),
      comparePrice: Math.max(0, Math.floor(Number(x.product.comparePrice) || 0)),
      img: String(x.product.img || '').trim().slice(0, 500),
      slug: txt(x.product.slug, 120),
    } : null,
    // html creative (sanitised: scripts, handlers, iframes, forms are removed)
    html: type === 'html' ? safeHtml(String(x.html || '')) : '',
    // delivery rules
    dailyImpressions: Math.max(0, Math.floor(Number(x.dailyImpressions)) || 0), // 0 = unlimited
    priority: Math.max(0, Math.min(10, Math.floor(Number(x.priority)) || 0)),
    autoOptimize: x.autoOptimize !== false,
    startAt: Math.max(0, Math.floor(Number(x.startAt)) || 0),
    endAt: Math.max(0, Math.floor(Number(x.endAt)) || 0),
    createdAt: Math.max(0, Math.floor(Number(x.createdAt)) || Date.now()),
    updatedAt: Date.now(),
  };
  if (type !== 'html') ad.html = '';
  return ad;
}

// Same hygiene as lib/inject.js: no scripts, handlers, iframes or forms in ad HTML.
function safeHtml(html) {
  return String(html || '')
    .replace(/<\s*(script|iframe|object|embed|form|meta|link|base)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '')
    .replace(/<\s*(script|iframe|object|embed|form|meta|link|base)\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|xlink:href)\s*=\s*("?\s*javascript:[^"]*"?|'\s*javascript:[^']*')/gi, '$1="#"');
}

export function cleanStats(x = {}) {
  const days = {};
  if (x.days && typeof x.days === 'object') {
    for (const [k, v] of Object.entries(x.days).slice(0, 90)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && v && typeof v === 'object') {
        days[k] = { i: Math.max(0, Math.floor(Number(v.i) || 0)), c: Math.max(0, Math.floor(Number(v.c) || 0)) };
      }
    }
  }
  return {
    impressions: Math.max(0, Math.floor(Number(x.impressions)) || 0),
    clicks: Math.max(0, Math.floor(Number(x.clicks)) || 0),
    days: Object.keys(days).sort().slice(-30).reduce((o, k) => { o[k] = days[k]; return o; }, {}),
    updatedAt: Date.now(),
  };
}

export const todayKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export function cleanConfig(x = {}) {
  const c = { ...DEFAULT_CONFIG };
  for (const k of Object.keys(DEFAULT_CONFIG)) {
    if (x[k] === undefined) continue;
    if (typeof DEFAULT_CONFIG[k] === 'boolean') c[k] = Boolean(x[k]);
    else if (typeof DEFAULT_CONFIG[k] === 'number') c[k] = Math.max(1, Math.floor(Number(x[k]) || DEFAULT_CONFIG[k]));
  }
  c.rotateMs = Math.max(2000, Math.min(60000, c.rotateMs));
  c.perView = Math.max(1, Math.min(10, c.perView));
  c.maxAdsPerKey = Math.max(1, Math.min(12, c.maxAdsPerKey));
  return c;
}

// -----------------------------------------------------------------------------
// KEYS
// -----------------------------------------------------------------------------
export const KEY_PREFIX = 'mza_';
export const keyIdOf = (fullKey) => String(fullKey || '').replace(/^mza_/, '').slice(0, 24);
export const keyPrefixOf = (fullKey) => `${KEY_PREFIX}${String(fullKey || '').replace(/^mza_/, '').slice(0, 6)}…`;

// -----------------------------------------------------------------------------
// AUTO-OPTIMISE ENGINE
// -----------------------------------------------------------------------------
// Score = 50 base + priority + CTR (per 1000 impressions, capped) + click
// history + a small freshness bonus for new ads (so every ad gets a chance).
export function scoreAd(ad, stats = {}) {
  const imp = Math.max(0, Math.floor(Number(stats.impressions) || 0));
  const cl = Math.max(0, Math.floor(Number(stats.clicks) || 0));
  let score = 50 + (ad.priority || 0) * 12;
  if (imp > 0) score += Math.min(1, (cl / imp) * 3) * 40; // up to +40
  if (cl > 0) score += Math.min(20, Math.log10(cl + 1) * 8);
  const ageDays = (Date.now() - (ad.createdAt || Date.now())) / 86400000;
  score += Math.max(0, 10 - ageDays) * 0.2; // +2 for a brand-new ad, fading over 10 days
  return score;
}

// Weighted random pick: high-score ads appear more often. Returns `count` ads.
export function pickAds(ads, statsById = {}, { count = 1, autoOptimize = true, type = '' } = {}) {
  const pool = ads.filter((a) => {
    if (a.status !== 'active') return false;
    if (type && a.type !== type && !a.autoOptimize) return false; // a specific slot still prefers its own kind
    return true;
  });
  if (!pool.length) return [];
  const weighted = pool.map((a) => {
    const s = statsById[a.id] || {};
    const score = autoOptimize && a.autoOptimize ? scoreAd(a, s) : 50 + (a.priority || 0) * 12;
    return { a, w: Math.max(1, score) };
  });
  const out = [];
  const avail = [...weighted];
  for (let i = 0; i < count && avail.length; i++) {
    const total = avail.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    let pick = avail[0];
    for (const x of avail) { r -= x.w; if (r <= 0) { pick = x; break; } }
    out.push(pick.a);
    avail.splice(avail.indexOf(pick), 1);
  }
  return out;
}

// Budget: how many impressions an ad may still have today (0 = unlimited).
export function budgetLeft(ad, stats = {}) {
  if (!ad.dailyImpressions) return Infinity;
  const today = (stats.days || {})[todayKey()] || {};
  return ad.dailyImpressions - (today.i || 0);
}

// -----------------------------------------------------------------------------
// CREATIVE: what the browser receives (no internal fields)
// -----------------------------------------------------------------------------
export function buildCreative(ad, { token = '' } = {}) {
  const base = {
    id: ad.id,
    type: ad.type,
    name: ad.name,
    headline: ad.headline,
    sub: ad.sub,
    cta: ad.cta,
    href: ad.href,
    img: ad.img,
    bg: ad.bg,
    anim: ad.anim,
    token,
  };
  if (ad.type === 'video') base.video = { ...ad.video };
  if (ad.type === 'product' && ad.product) base.product = { ...ad.product };
  if (ad.type === 'html' && ad.html) base.html = ad.html;
  return base;
}

// Signed tokens live in lib/adsServer.js (they need node:crypto). Keeping this
// file free of node imports means the admin panel can use it in the browser.
