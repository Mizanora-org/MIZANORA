import { adminDb, adminReady } from './firebase-admin';

// Google Gemini with SEVERAL API keys and a MODEL LADDER.
//
// Keys come from the admin panel (Firestore "assistantKeys", readable only by the server) and/or the Vercel variables
// GEMINI_API_KEY / GEMINI_API_KEYS (comma separated). Both key styles work:
//   AIza...  (old "traffic" keys)      AQ.Ab8...  (new AI Studio "authorization" keys)
//
// RATE LIMIT SAVER: every call walks a ladder of models (the cheap "lite" model first for searches). A 429 only rests the ONE
// key+model pair that was limited (for the time Google asks for), so the same key can still serve the next model and the next
// key serves the same model. A model that does not exist for a key (404) is skipped for hours instead of being retried.
export const DEFAULT_CFG = {
  enabled: true, name: 'Noor', model: 'gemini-flash-latest', searchModel: 'gemini-flash-lite-latest', voiceMode: 'browser', voiceName: 'Kore',
  maxOff: 100, maxPct: 15, insistAfter: 2, greeting: '',
};

// Last resorts after the admin's chosen model. Unknown / retired names are skipped automatically (404 -> rested for hours).
const CHAT_TAIL = ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
const FAST_TAIL = ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];
const uniq = (a) => [...new Set(a.filter(Boolean))];
// kind: 'chat' (the assistant talks) or 'fast' (search understanding: tiny answer, cheapest model first)
export const ladderFor = (cfg, kind = 'chat') => (kind === 'fast'
  ? uniq([cfg.searchModel, ...FAST_TAIL, cfg.model]).slice(0, 4)
  : uniq([cfg.model, ...CHAT_TAIL]).slice(0, 4));

// ---- keys -------------------------------------------------------------------------------------------------------------
// Old keys are letters/digits/_/-. The new AQ. keys also contain DOTS (AQ.Ab8RN6...), which the old check wrongly rejected.
export const KEY_RE = /^[A-Za-z0-9_.~\-]{20,220}$/;
export const cleanKey = (raw) => String(raw || '').trim().replace(/^["'`]+|["'`,;]+$/g, '').replace(/^(?:bearer|key|api[_ -]?key|gemini[_ -]?api[_ -]?key)\s*[:=]?\s*/i, '').trim();
// Accepts one key or many (separated by new lines, spaces, commas or semicolons).
export const splitKeys = (raw) => uniq(String(raw || '').split(/[\s,;]+/).map(cleanKey)).filter((k) => KEY_RE.test(k));

let cfgCache = { t: 0, v: null };
export function clearAssistantCache() { cfgCache = { t: 0, v: null }; }

const envKeys = () => splitKeys([process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEYS, process.env.GOOGLE_API_KEY].filter(Boolean).join(','));

const clampCfg = (c = {}) => ({
  enabled: c.enabled !== false,
  name: String(c.name || DEFAULT_CFG.name).slice(0, 24),
  model: String(c.model || DEFAULT_CFG.model).slice(0, 60),
  searchModel: String(c.searchModel || DEFAULT_CFG.searchModel).slice(0, 60),
  voiceMode: c.voiceMode === 'gemini' ? 'gemini' : 'browser',
  voiceName: String(c.voiceName || DEFAULT_CFG.voiceName).slice(0, 24),
  maxOff: Math.max(0, Math.min(500, Math.floor(Number(c.maxOff ?? DEFAULT_CFG.maxOff)) || 0)),
  maxPct: Math.max(0, Math.min(40, Math.floor(Number(c.maxPct ?? DEFAULT_CFG.maxPct)) || 0)),
  insistAfter: Math.max(1, Math.min(5, Math.floor(Number(c.insistAfter ?? DEFAULT_CFG.insistAfter)) || 2)),
  greeting: String(c.greeting || '').slice(0, 300),
});

// Settings + keys, remembered in memory for 2 minutes (so chatting never costs a Firestore read per message).
export async function loadAssistant(force = false) {
  if (!force && cfgCache.v && Date.now() - cfgCache.t < 120000) return cfgCache.v;
  let cfg = { ...DEFAULT_CFG };
  const keys = [];
  if (adminReady()) {
    try {
      const db = adminDb();
      const [c, k] = await Promise.all([db.collection('assistantConfig').doc('main').get(), db.collection('assistantKeys').get()]);
      if (c.exists) cfg = clampCfg(c.data()); else cfg = clampCfg(cfg);
      k.docs.forEach((d) => { const x = d.data(); const key = cleanKey(x.key); if (key && x.active !== false) keys.push({ id: d.id, key, label: x.label || '' }); });
    } catch (e) { console.error('assistant config read failed:', e.message); cfg = clampCfg(cfg); }
  } else cfg = clampCfg(cfg);
  envKeys().forEach((key, i) => keys.push({ id: `env${i}`, key, label: 'Vercel variable' }));
  cfgCache = { t: Date.now(), v: { cfg, keys } };
  return cfgCache.v;
}

// ---- cool-downs -------------------------------------------------------------------------------------------------------
const restPair = new Map();  // "keyId|model" -> time until which this key may not be used for this model
const restKey = new Map();   // keyId -> time until which the whole key is skipped (invalid key)
const deadModel = new Map(); // model -> time until which the model is skipped for every key (does not exist)
const tried = new Set();     // models we have used, so keyState() can tell when a key is limited on all of them
let turn = 0;
const lastErr = new Map();   // keyId -> last error text (shown by the "Test" button)
const now = () => Date.now();
const live = (t) => (t || 0) > now();

export function keyState() {
  const out = {};
  for (const [id, t] of restKey) if (live(t)) out[id] = t;
  const ids = new Set([...restPair.keys()].map((k) => k.split('|')[0]));
  for (const id of ids) {
    const open = [...tried].filter((m) => !live(deadModel.get(m))).some((m) => !live(restPair.get(`${id}|${m}`)));
    if (!open && tried.size) out[id] = Math.max(...[...tried].map((m) => restPair.get(`${id}|${m}`) || 0));
  }
  return out;
}
export const lastKeyError = (id) => lastErr.get(id) || '';

// How long to rest after an error. Returns { scope: 'pair' | 'key' | 'model' | 'none', ms }.
function restAfter(status, text) {
  const t = String(text || '');
  if (status === 429) {
    const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(t) || /retry in (\d+(?:\.\d+)?)s/i.exec(t);
    if (/limit:\s*0\b/.test(t)) return { scope: 'pair', ms: 6 * 3600e3 };            // this model has no free quota on this key
    if (/PerDay|per day|daily/i.test(t)) return { scope: 'pair', ms: 3 * 3600e3 };    // daily quota used up
    return { scope: 'pair', ms: Math.min(5 * 60e3, ((m ? Number(m[1]) : 40) + 2) * 1000) };
  }
  if (status === 404 || (status === 400 && /not found|not supported|is not found for API|unsupported model/i.test(t))) return { scope: 'model', ms: 6 * 3600e3 };
  if (status === 403 && /model/i.test(t) && !/API key|API_KEY/i.test(t)) return { scope: 'pair', ms: 6 * 3600e3 };
  if (status === 401 || status === 403 || (status === 400 && /API key|API_KEY|credentials/i.test(t))) return { scope: 'key', ms: 60 * 60e3 };
  if (status >= 500 || status === 408) return { scope: 'pair', ms: 15e3 };
  return { scope: 'none', ms: 0 };
}

// Plain-language reason for the admin "Test" button.
export function explainError(status, text) {
  const t = String(text || '');
  if (/ACCESS_TOKEN_TYPE_UNSUPPORTED/i.test(t)) return 'Google rejected this key type for this project. Create a NEW key in aistudio.google.com/apikey (Create API key), copy the whole text including "AQ." and paste it again.';
  if (status === 401 || /API key|API_KEY|credentials/i.test(t)) return 'The key is not accepted. Copy the whole key again (nothing missing at the end) from aistudio.google.com/apikey.';
  if (status === 429) return /limit:\s*0/.test(t) ? 'This model has no free quota on this key. Another model will be used automatically.' : 'Free limit reached for now. The key rests for a short time and the next model/key is used.';
  if (status === 403) return 'This key has no permission for the Gemini API. In Google Cloud / AI Studio make sure the Generative Language API is allowed for it.';
  if (status === 404) return 'That model name does not exist for this key. Try another model in Settings.';
  return `HTTP ${status}. ${t.slice(0, 120)}`;
}

// POST to Gemini with the model ladder and automatic key rotation.
//   model: one model name OR a list (ladder)    options: { timeoutMs, deadlineMs, keys, maxTries }
// Returns { ok, json, keyId, model } or { ok:false, status, error, retryAfter }.
export async function geminiCall(model, body, { timeoutMs = 20000, deadlineMs = 0, keys: only, maxTries = 5 } = {}) {
  const { keys: all } = await loadAssistant();
  const keys = only || all;
  if (!keys.length) return { ok: false, status: 501, error: 'No Gemini API key set.' };
  const models = uniq(Array.isArray(model) ? model : [model]);
  models.forEach((m) => tried.add(m));
  const start = turn++ % keys.length;
  const rotated = keys.map((_, i) => keys[(start + i) % keys.length]);
  // best model first on every key, then the next model
  const plan = [];
  for (const m of models) {
    if (live(deadModel.get(m))) continue;
    for (const k of rotated) if (!live(restKey.get(k.id)) && !live(restPair.get(`${k.id}|${m}`))) plan.push({ m, k });
  }
  if (!plan.length) {
    const waits = [...restPair.values(), ...restKey.values()].filter(live);
    const retryAfter = waits.length ? Math.max(1, Math.ceil((Math.min(...waits) - now()) / 1000)) : 30;
    return { ok: false, status: 429, error: 'All keys are resting (free limit reached).', retryAfter };
  }
  const stopAt = deadlineMs ? now() + deadlineMs : 0;
  let last = { ok: false, status: 502, error: 'Gemini is not reachable.' };
  for (const { m, k } of plan.slice(0, maxTries)) {
    if (stopAt && now() > stopAt - 1500) break;
    if (live(deadModel.get(m)) || live(restKey.get(k.id)) || live(restPair.get(`${k.id}|${m}`))) continue; // changed while we were trying
    try {
      const t = stopAt ? Math.max(2500, Math.min(timeoutMs, stopAt - now())) : timeoutMs;
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(t),
        headers: { 'content-type': 'application/json', 'x-goog-api-key': k.key },
        body: JSON.stringify(body),
      });
      if (r.ok) { lastErr.delete(k.id); return { ok: true, json: await r.json(), keyId: k.id, model: m }; }
      const txt = await r.text().catch(() => '');
      last = { ok: false, status: r.status, error: txt.slice(0, 300) };
      lastErr.set(k.id, explainError(r.status, txt));
      const rest = restAfter(r.status, txt);
      if (rest.scope === 'pair') restPair.set(`${k.id}|${m}`, now() + rest.ms);
      else if (rest.scope === 'key') restKey.set(k.id, now() + rest.ms);
      else if (rest.scope === 'model') deadModel.set(m, now() + rest.ms);
      else return last; // our request itself is wrong (400): another key will not help
      if (r.status === 429) last.retryAfter = Math.ceil(rest.ms / 1000);
    } catch (e) { last = { ok: false, status: 504, error: e.message }; restPair.set(`${k.id}|${m}`, now() + 8e3); }
  }
  return last;
}

export const textOf = (j) => ((j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).map((c) => c.text || '').join('');
