'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { authClient } from '@/lib/firebase-client';

// ADMIN AI MANAGER: chat with the AI that runs tasks for you (season look, video feed, Islamic posts, products, to-dos, research, blogs).
// Safe actions run at once. Risky ones (prices, deletes, Islamic posts, blog publishing) appear as a card that YOU must confirm.
const CHIPS = [
  'Shop ka overview dikhao',
  'Winter theme lagao',
  'Is video ko feed mein add karo: ',
  'Aaj ke tasks dikhao',
  'Pakistan mein online shopping ke top keywords par research karo',
  'Ek naya Islami hadees post tayyar karo (sirf wo jo pakka ho)',
];

export default function AdminAi() {
  const [msgs, setMsgs] = useState([{ role: 'model', text: 'Assalam o Alaikum! Main Mizanora ka AI manager hoon. Season theme, video feed, Islami feed, products, tasks, research aur blogs mujhe bata dein. Qeemat badalna, delete karna ya Islami post/blog publish karna aap ke Confirm ke baghair nahi hota.' }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [side, setSide] = useState(null);
  const end = useRef(null);

  const call = useCallback(async (method, body) => {
    const token = await authClient().currentUser.getIdToken();
    const r = await fetch('/api/admin/ai-manager', { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.error || `Error ${r.status}`);
    return j;
  }, []);

  const loadSide = useCallback(() => { call('GET').then(setSide).catch(() => setSide({ tasks: [], log: [] })); }, [call]);
  useEffect(() => { loadSide(); }, [loadSide]);
  useEffect(() => { if (end.current) end.current.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy]);

  async function send(t) {
    const m = String(t || text).trim();
    if (!m || busy) return;
    setText(''); setBusy(true);
    const next = [...msgs, { role: 'user', text: m }];
    setMsgs(next);
    try {
      const j = await call('POST', { messages: next.filter((x) => !x.err).map((x) => ({ role: x.role, text: x.text })) });
      setMsgs([...next, { role: 'model', text: j.text, actions: j.actions, pending: j.pending }]);
      loadSide();
    } catch (e) { setMsgs([...next, { role: 'model', text: e.message, err: true }]); }
    setBusy(false);
  }

  async function confirm(i, k, p) {
    setBusy(true);
    try {
      const j = await call('POST', { confirm: { tool: p.tool, args: p.args } });
      setMsgs((cur) => cur.map((x, n) => (n === i ? { ...x, pending: (x.pending || []).filter((_, q) => q !== k) } : x)).concat({ role: 'model', text: j.text }));
      loadSide();
    } catch (e) { setMsgs((cur) => cur.concat({ role: 'model', text: e.message, err: true })); }
    setBusy(false);
  }
  const cancel = (i, k) => setMsgs((cur) => cur.map((x, n) => (n === i ? { ...x, pending: (x.pending || []).filter((_, q) => q !== k) } : x)));

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <h1 className="mb-1 text-3xl font-extrabold">AI Manager</h1>
        <p className="mb-3 text-sm text-dim">Ek AI jo aap ke kehne par shop ke kaam karta hai. Har kaam ka record neeche &quot;Recent actions&quot; mein rehta hai.</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {CHIPS.map((c) => <button key={c} type="button" onClick={() => (c.endsWith(': ') ? setText(c) : send(c))} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-dim hover:bg-raised">{c}</button>)}
        </div>
        <div className="card !p-3">
          <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-1">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
                <div className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'bg-gold text-white' : m.err ? 'bg-red-50 text-red-800' : 'bg-raised text-cream'}`}>
                  {m.text}
                  {(m.actions || []).length > 0 && <ul className="mt-2 space-y-1 border-t border-line pt-2 text-xs text-dim">{m.actions.map((a, k) => <li key={k}>{a.ok ? 'Done' : 'Failed'}: <b>{a.tool}</b> {a.summary}</li>)}</ul>}
                  {(m.pending || []).map((p, k) => (
                    <div key={k} className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950">
                      <p className="text-xs font-extrabold uppercase tracking-wide">Aap ki manzoori chahiye</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{p.summary}</p>
                      <div className="mt-2 flex gap-2"><button type="button" disabled={busy} onClick={() => confirm(i, k, p)} className="btn-gold !px-4 !py-1.5 text-sm">Confirm</button><button type="button" disabled={busy} onClick={() => cancel(i, k)} className="btn-ghost !px-4 !py-1.5 text-sm">Cancel</button></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {busy && <p className="text-xs text-faint">AI kaam kar raha hai...</p>}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-3 flex gap-2">
            <input className="input flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="Jaise: winter theme lagao / is video ko add karo: https://..." disabled={busy} />
            <button className="btn-gold !px-5" disabled={busy || !text.trim()}>Bhejein</button>
          </form>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="card !p-4">
          <h2 className="mb-2 font-extrabold">Open tasks</h2>
          {!side ? <p className="text-sm text-dim">Loading...</p> : side.tasks.length === 0 ? <p className="text-sm text-dim">Koi open task nahi. AI se kahein: &quot;kal ye kaam yaad dilana&quot;.</p> : <ul className="space-y-2 text-sm">{side.tasks.map((t) => <li key={t.id}><b>{t.title}</b>{t.due ? <span className="text-xs text-faint"> · {t.due}</span> : null}{t.notes ? <span className="block text-xs text-dim">{t.notes}</span> : null}</li>)}</ul>}
        </div>
        <div className="card !p-4">
          <h2 className="mb-2 font-extrabold">Recent actions</h2>
          {!side ? <p className="text-sm text-dim">Loading...</p> : side.log.length === 0 ? <p className="text-sm text-dim">Abhi tak koi action nahi.</p> : <ul className="space-y-1.5 text-xs text-dim">{side.log.map((l) => <li key={l.id}><b className={l.ok ? 'text-gold' : 'text-red-700'}>{l.tool}</b> {l.summary}</li>)}</ul>}
        </div>
        <p className="text-xs text-faint">AI ke paas sirf upar wale tools hain. API keys, passwords, payments aur customers ke phone/address tak us ki rasai nahi.</p>
      </aside>
    </div>
  );
}
