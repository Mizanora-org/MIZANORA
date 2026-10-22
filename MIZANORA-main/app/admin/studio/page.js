'use client';
import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { AlertTriangle, Code2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { dbClient } from '@/lib/firebase-client';
import { revalidateSite } from '@/lib/admin-cache';
import { EFFECTS, INJECT_DOC, MAX_ITEMS, TYPES, cleanInject, cleanItem } from '@/lib/inject';

// Admin > Studio: animations (one tap each) and your own CSS / JavaScript / HTML snippets for the whole shop.
// The AI manager can prepare snippets for you here too (you press Confirm in the AI chat); everything it adds shows up in this list.
const TEMPLATES = {
  css: { name: 'Gold border on cards', type: 'css', pages: 'all', code: '/* every product card gets a soft gold border */\n[data-card] { border-color: rgba(242, 184, 75, .55) !important; }\n' },
  html: { name: 'Welcome ribbon', type: 'html', where: 'top', pages: 'home', code: '<div style="background:#0B6B45;color:#fff;text-align:center;padding:8px 12px;font-size:14px">Assalam o Alaikum! Aaj ki khaas deals: <a href="/deals" style="color:#F2C766;font-weight:700">dekhein</a></div>' },
  js: { name: 'Console hello (test)', type: 'js', pages: 'all', code: '// runs once per visit. MZ.onRoute(fn) runs fn now and after every page change.\nMZ.onRoute(function (path) { console.log("Mizanora page:", path); });\n' },
};

export default function AdminStudio() {
  const [cfg, setCfg] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState('');

  useEffect(() => {
    getDoc(doc(dbClient(), INJECT_DOC.collection, INJECT_DOC.id)).then((d) => setCfg(cleanInject(d.exists() ? d.data() : {})))
      .catch((e) => { setMsg(`Could not read: ${e.message}`); setCfg(cleanInject({})); });
  }, []);
  if (!cfg) return <p className="p-6 text-dim">Loading...</p>;

  const setItem = (id, patch) => setCfg((c) => ({ ...c, items: c.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const toggleFx = (id) => setCfg((c) => ({ ...c, effects: c.effects.includes(id) ? c.effects.filter((e) => e !== id) : [...c.effects, id] }));
  const add = (kind) => {
    const t = TEMPLATES[kind];
    const it = cleanItem({ ...t, enabled: false });
    if (!it) return;
    setCfg((c) => ({ ...c, items: [...c.items, it] })); setOpen(it.id);
  };

  async function save() {
    setBusy(true); setMsg('');
    try {
      // keep unfinished (empty) snippets out; tell the admin
      const before = cfg.items.length;
      const clean = cleanInject(cfg);
      await setDoc(doc(dbClient(), INJECT_DOC.collection, INJECT_DOC.id), { ...clean, updatedAtMs: Date.now() });
      setCfg(clean);
      await revalidateSite(undefined, ['inject']);
      setMsg(`Saved.${clean.items.length < before ? ` ${before - clean.items.length} empty snippet(s) were left out.` : ''} The shop shows it within a few seconds.`);
    } catch (e) { setMsg(`Could not save: ${e.message}`); }
    setBusy(false);
  }

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-extrabold"><Sparkles className="text-gold" /> Studio</h1>
        <p className="mt-1 text-sm text-dim">Animations and your own code for the whole shop. Nothing runs inside this admin panel.</p>
      </div>
      {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm text-cream">{msg}</p>}

      <section className="card space-y-2">
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-red-600" checked={cfg.disabled} onChange={(e) => setCfg((c) => ({ ...c, disabled: e.target.checked }))} />
          <span><b className="text-cream">Emergency switch: turn EVERYTHING here off</b><br /><small className="text-dim">Animations and all snippets stop for every visitor. Tip: to test one visit without them, add <code>?noinject=1</code> to any shop address.</small></span></label>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-extrabold">1. Ready-made animations</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {EFFECTS.map((e) => (
            <label key={e.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 text-sm ${cfg.effects.includes(e.id) ? 'border-gold bg-gold/5' : 'border-line'}`}>
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0B6B45]" checked={cfg.effects.includes(e.id)} onChange={() => toggleFx(e.id)} />
              <span><b className="block text-cream">{e.label}</b><small className="text-dim">{e.desc}</small></span>
            </label>
          ))}
        </div>
      </section>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-extrabold"><Code2 size={20} /> 2. Your own code</h2>
          <div className="flex flex-wrap gap-2">
            {[['css', 'CSS'], ['html', 'HTML block'], ['js', 'JavaScript']].map(([k, l]) => <button key={k} type="button" disabled={cfg.items.length >= MAX_ITEMS} onClick={() => add(k)} className="btn-ghost !px-3 !py-1.5 text-xs"><Plus size={13} /> {l}</button>)}
          </div>
        </div>
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> JavaScript runs on every visitor's phone with full access to the page. Only paste code you wrote or fully understand. New snippets start switched OFF.</p>
        {!cfg.items.length && <p className="text-sm text-dim">No snippets yet.</p>}
        {cfg.items.map((it) => (
          <div key={it.id} className="rounded-xl border border-line bg-surface">
            <div className="flex flex-wrap items-center gap-3 p-3">
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" className="h-4 w-4 accent-[#0B6B45]" checked={it.enabled} onChange={(e) => setItem(it.id, { enabled: e.target.checked })} /> {it.enabled ? 'On' : 'Off'}</label>
              <button type="button" onClick={() => setOpen(open === it.id ? '' : it.id)} className="min-w-0 flex-1 text-left"><b className="block truncate">{it.name}</b><small className="text-faint">{it.type.toUpperCase()} · {it.pages === 'all' ? 'every page' : it.pages}{it.by === 'ai' ? ' · made by the AI manager' : ''}</small></button>
              <button type="button" onClick={() => setCfg((c) => ({ ...c, items: c.items.filter((x) => x.id !== it.id) }))} className="text-red-600" aria-label="Delete"><Trash2 size={18} /></button>
            </div>
            {open === it.id && (
              <div className="space-y-3 border-t border-line p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm"><span className="label">Name</span><input className="input" maxLength={60} value={it.name} onChange={(e) => setItem(it.id, { name: e.target.value })} /></label>
                  <label className="block text-sm"><span className="label">Type</span><select className="input" value={it.type} onChange={(e) => setItem(it.id, { type: e.target.value })}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                  <label className="block text-sm"><span className="label">Pages: all, home, or paths like /products,/deals</span><input className="input" value={it.pages} onChange={(e) => setItem(it.id, { pages: e.target.value })} /></label>
                  {it.type === 'html' && <label className="block text-sm"><span className="label">Position</span><select className="input" value={it.where} onChange={(e) => setItem(it.id, { where: e.target.value })}><option value="top">Above the page (under the header)</option><option value="end">Below the page</option></select></label>}
                </div>
                <label className="block text-sm"><span className="label">Code</span><textarea className="input font-mono !text-xs" rows={12} spellCheck={false} value={it.code} onChange={(e) => setItem(it.id, { code: e.target.value })} /></label>
              </div>
            )}
          </div>
        ))}
      </section>

      <div className="sticky bottom-3 z-10 flex items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur">
        <button type="button" className="btn-gold" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save'}</button>
        <span className="text-xs text-dim">Visitors get the change within seconds of saving.</span>
      </div>
    </div>
  );
}
