'use client';
import { useCallback, useEffect, useState } from 'react';
import { authClient } from '@/lib/firebase-client';

const VOICES = ['Kore', 'Aoede', 'Leda', 'Zephyr', 'Puck', 'Charon'];

export default function AdminAssistant() {
  const [data, setData] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState({});

  const call = useCallback(async (method, body) => {
    const token = await authClient().currentUser.getIdToken();
    const r = await fetch('/api/admin/assistant', { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || `Error ${r.status}`);
    return j;
  }, []);

  const apply = (j) => { setData(j); setCfg((c) => c || j.cfg); };
  useEffect(() => { call('GET').then(apply).catch((e) => setMsg(e.message)); }, [call]);

  const run = async (fn, ok) => {
    setBusy(true); setMsg('');
    try { await fn(); if (ok) setMsg(ok); } catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  const addKey = (e) => { e.preventDefault(); run(async () => { apply(await call('POST', { action: 'addKey', label, key })); setKey(''); setLabel(''); }, 'Key(s) added. They are used together with your other keys.'); };
  const saveCfg = () => run(async () => { const j = await call('POST', { action: 'saveConfig', cfg }); setData(j); setCfg(j.cfg); }, 'Saved. The change shows on the website within a minute.');
  const del = (id) => { if (window.confirm('Delete this key?')) run(async () => apply(await call('POST', { action: 'deleteKey', id }))); };
  const testKey = (id) => run(async () => { const j = await call('POST', { action: 'testKey', id }); setTest((t) => ({ ...t, [id]: j })); });
  const set = (k) => (e) => setCfg((c) => ({ ...c, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  if (!data || !cfg) return <p className="text-sm text-dim">{msg || 'Loading...'}</p>;
  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-xl font-bold text-cream">AI shopping assistant ({cfg.name || 'Noor'})</h2>
        <p className="mt-1 text-sm text-dim">Customers can ask about products, Mizanora pages and general topics by text or voice. General answers need a working Gemini key; basic product and page help remains available in limited mode.</p>
        {msg && <p role="status" className="mt-3 rounded-lg bg-raised p-3 text-sm text-cream">{msg}</p>}
      </section>

      <section className="card p-4">
        <h3 className="font-bold text-cream">Gemini API keys ({data.keys.length})</h3>
        <p className="mt-1 text-xs text-dim">Add as many keys as you like (from aistudio.google.com/apikey). Chats are spread over all keys, and if one key runs out of free limit the next one is used automatically. Keys are saved where only the server can read them.</p>
        <ul className="mt-3 space-y-2">
          {data.keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2.5 text-sm">
              <span className="font-mono text-cream">{k.masked}</span>
              <span className="text-dim">{k.label}{k.fromEnv ? ' (Vercel variable)' : ''}</span>
              {k.resting && <span className="rounded-full bg-saffron/20 px-2 py-0.5 text-xs font-semibold text-gold">resting (limit reached, back soon)</span>}
              <span className="ml-auto flex gap-2">
                <button type="button" disabled={busy} onClick={() => testKey(k.id)} className="btn-ghost !px-3 !py-1.5 text-xs">Test</button>
                {!k.fromEnv && <button type="button" disabled={busy} onClick={() => del(k.id)} className="btn-ghost !px-3 !py-1.5 text-xs text-red-600">Delete</button>}
              </span>
              {test[k.id] && <p className={`w-full text-xs ${test[k.id].works ? 'font-semibold text-gold' : 'text-red-600'}`}>{test[k.id].detail}</p>}
            </li>
          ))}
          {!data.keys.length && <li className="text-sm text-red-600">No key yet. Noor can offer basic product search and page links, but general AI answers need a working Gemini key.</li>}
        </ul>
        <form onSubmit={addKey} className="mt-4 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <input className="input" placeholder="Name (e.g. Key 2)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <textarea className="input min-h-[2.75rem] font-mono" rows={2} placeholder="AQ.Ab8... or AIza...  (you can paste several keys, one per line)" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} />
          <button className="btn-gold" disabled={busy || !key.trim()}>Add key</button>
        </form>
        <p className="mt-2 text-xs text-dim">New AI Studio keys start with <b>AQ.</b> (with a dot). Both AQ. and AIza keys work. Tip: every key is a separate free limit, so 3 to 5 keys from different Google accounts/projects make the assistant and AI search last much longer.</p>
      </section>

      <section className="card space-y-4 p-4">
        <h3 className="font-bold text-cream">Settings</h3>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#0B6B45]" checked={cfg.enabled} onChange={set('enabled')} /> Assistant is ON for customers</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm"><span className="label">Assistant name</span><input className="input" value={cfg.name} onChange={set('name')} maxLength={24} /></label>
          <label className="text-sm"><span className="label">Chat model (assistant talking)</span><input className="input" value={cfg.model} onChange={set('model')} /></label>
          <label className="text-sm"><span className="label">Answer speed</span>
            <select className="input" value={cfg.speed || 'fast'} onChange={set('speed')}>
              <option value="fast">Fast (default): the quick lite model answers first</option>
              <option value="smart">Smart: the model above answers first (slower, a little deeper)</option>
            </select></label>
          <label className="text-sm"><span className="label">Search model (AI search, small + cheap)</span><input className="input" value={cfg.searchModel || ''} onChange={set('searchModel')} placeholder="gemini-flash-lite-latest" /></label>
          <label className="text-sm"><span className="label">Voice</span>
            <select className="input" value={cfg.voiceMode} onChange={set('voiceMode')}>
              <option value="browser">Phone/browser voice (free, no extra limit)</option>
              <option value="gemini">Gemini female voice (more natural, uses your key limit)</option>
            </select>
          </label>
          <label className="text-sm"><span className="label">Gemini voice name</span>
            <select className="input" value={cfg.voiceName} onChange={set('voiceName')}>{VOICES.map((v) => <option key={v}>{v}</option>)}</select>
          </label>
        </div>
        <label className="block text-sm"><span className="label">Opening words (empty = default)</span><input className="input" value={cfg.greeting} onChange={set('greeting')} maxLength={300} placeholder="Assalam o Alaikum! Main Noor hoon, Mizanora ki assistant..." /></label>

        <div>
          <p className="font-semibold text-cream">Price bargaining</p>
          <p className="text-xs text-dim">Set by YOU, enforced by the server. The assistant cannot go beyond these limits. When your supplier cost is saved for a product, she also always keeps at least Rs 50 profit.</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <label className="text-sm"><span className="label">Most Rs off per piece</span><input type="number" min="0" max="500" className="input" value={cfg.maxOff} onChange={set('maxOff')} /></label>
            <label className="text-sm"><span className="label">Never more than % of price</span><input type="number" min="0" max="40" className="input" value={cfg.maxPct} onChange={set('maxPct')} /></label>
            <label className="text-sm"><span className="label">Customer must ask this many times</span><input type="number" min="1" max="5" className="input" value={cfg.insistAfter} onChange={set('insistAfter')} /></label>
          </div>
          <p className="mt-2 text-xs text-dim">Example with 2: first request = polite no, second = half the discount, third = the full discount (final). Set "Most Rs off" to 0 to stop bargaining. A deal cannot be combined with a promo code and is valid for 3 hours, up to 5 pieces.</p>
        </div>
        <button type="button" className="btn-gold" disabled={busy} onClick={saveCfg}>Save settings</button>
      </section>
    </div>
  );
}
