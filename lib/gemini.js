import { adminDb, adminReady } from './firebase-admin';

// Google Gemini with SEVERAL API keys.
// Keys come from the admin panel (Firestore "assistantKeys", readable only by the server) and/or the Vercel variables
// GEMINI_API_KEY / GEMINI_API_KEYS (comma separated). Calls are spread over all keys; when one key is out of quota or
// invalid the next key is used automatically and the bad key rests for a while.
export const DEFAULT_CFG = {
  enabled: true, name: 'Noor', model: 'gemini-flash-latest', voiceMode: 'browser', voiceName: 'Kore',
  maxOff: 100, maxPct: 15, insistAfter: 2, greeting: '',
};

let cfgCache = { t: 0, v: null };
export function clearAssistantCache() { cfgCache = { t: 0, v: null }; }

const envKeys = () => [process.env.GEMINI_API_KEY, ...String(process.env.GEMINI_API_KEYS || '').split(',')].map((k) => String(k || '').trim()).filter(Boolean);

const clampCfg = (c = {}) => ({
  enabled: c.enabled !== false,
  name: String(c.name || DEFAULT_CFG.name).slice(0, 24),
  model: String(c.model || DEFAULT_CFG.model).slice(0, 60),
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
      k.docs.forEach((d) => { const x = d.data(); if (x.key && x.active !== false) keys.push({ id: d.id, key: String(x.key), label: x.label || '' }); });
    } catch (e) { console.error('assistant config read failed:', e.message); cfg = clampCfg(cfg); }
  } else cfg = clampCfg(cfg);
  envKeys().forEach((key, i) => keys.push({ id: `env${i}`, key, label: 'Vercel variable' }));
  cfgCache = { t: Date.now(), v: { cfg, keys } };
  return cfgCache.v;
}

const rest = new Map(); // key id -> time until which it rests
let turn = 0;
export const keyState = () => Object.fromEntries([...rest].filter(([, t]) => t > Date.now()).map(([id, t]) => [id, t]));

// POST to a Gemini model with automatic key rotation. Returns { ok, json } or { ok:false, status, error }.
export async function geminiCall(model, body, { timeoutMs = 20000, keys: only } = {}) {
  const { keys: all } = await loadAssistant();
  const keys = only || all;
  if (!keys.length) return { ok: false, status: 501, error: 'No Gemini API key set.' };
  const start = turn++ % keys.length;
  const order = keys.map((_, i) => keys[(start + i) % keys.length]);
  const ready = order.filter((k) => !(rest.get(k.id) > Date.now()));
  const tryList = ready.length ? ready : order;
  let last = { ok: false, status: 502, error: 'Gemini is not reachable.' };
  for (const k of tryList.slice(0, 4)) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(timeoutMs),
        headers: { 'content-type': 'application/json', 'x-goog-api-key': k.key },
        body: JSON.stringify(body),
      });
      if (r.ok) return { ok: true, json: await r.json(), keyId: k.id };
      const txt = await r.text().catch(() => '');
      last = { ok: false, status: r.status, error: txt.slice(0, 200) };
      if (r.status === 429) rest.set(k.id, Date.now() + 60 * 1000);
      else if (r.status === 400 && /API key|API_KEY/i.test(txt)) rest.set(k.id, Date.now() + 60 * 60 * 1000);
      else if (r.status === 401 || r.status === 403) rest.set(k.id, Date.now() + 60 * 60 * 1000);
      else if (r.status === 400 || r.status === 404) return last; // our request is wrong: another key will not help
    } catch (e) { last = { ok: false, status: 504, error: e.message }; }
  }
  return last;
}

export const textOf = (j) => ((j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).map((c) => c.text || '').join('');
