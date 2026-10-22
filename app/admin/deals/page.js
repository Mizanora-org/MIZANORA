'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Copy, ExternalLink, Flame, Plus, Trash2 } from 'lucide-react';
import { authClient, dbClient } from '@/lib/firebase-client';
import { revalidateSite } from '@/lib/admin-cache';
import { cleanGroup } from '@/lib/dealGroups';
import { DEALS_DEFAULT, DEALS_DOC, cleanDeals } from '@/lib/deals';
import { absUrl } from '@/lib/config';

// Admin > Deals: settings of the one-link deals page (/deals). Which products are deals is automatic: every in-stock product whose
// price is lower than its old price ("compare price"). To make a deal, set an old price on a product (Admin > Products), or ask the AI manager.
const pad = (n) => String(n).padStart(2, '0');
const toLocal = (ms) => { if (!ms) return ''; const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export default function AdminDeals() {
  const [cfg, setCfg] = useState(null);
  const [pinned, setPinned] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState({}); // per group: the last preview / result text

  useEffect(() => {
    getDoc(doc(dbClient(), DEALS_DOC.collection, DEALS_DOC.id)).then((d) => {
      const c = d.exists() ? cleanDeals({ ...DEALS_DEFAULT, ...d.data() }) : DEALS_DEFAULT;
      setCfg(c); setPinned(c.pinned.join('\n'));
    }).catch((e) => { setMsg(`Could not read: ${e.message}`); setCfg(DEALS_DEFAULT); });
  }, []);
  if (!cfg) return <p className="p-6 text-dim">Loading...</p>;
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const link = absUrl('/deals');

  async function save() {
    setBusy(true); setMsg('');
    try {
      const clean = cleanDeals({ ...cfg, pinned });
      await setDoc(doc(dbClient(), DEALS_DOC.collection, DEALS_DOC.id), { ...clean, updatedAtMs: Date.now() });
      setCfg(clean); setPinned(clean.pinned.join('\n'));
      await revalidateSite(undefined, ['deals-config']);
      setMsg('Saved. /deals is updated within a few seconds.');
    } catch (e) { setMsg(`Could not save: ${e.message}`); }
    setBusy(false);
  }
  const PRESETS = [['Shirts', 'shirt, tshirt, kameez'], ['Shoes', 'shoes, shoe, sneakers, sandal, joota'], ['Pants', 'pant, jeans, trouser, shalwar'], ['Watches', 'watch, ghari'], ['Mens catalogue', 'men, mens, man']];
  const setGroup = (i, patch) => setCfg((c) => ({ ...c, groups: c.groups.map((g, n) => (n === i ? { ...g, ...patch } : g)) }));
  const addGroup = (name = 'New group', words = '') => setCfg((c) => ({ ...c, groups: [...c.groups, { id: `g${Date.now().toString(36)}`, name, words: words.split(',').map((w) => w.trim()).filter(Boolean), exclude: name === 'Mens catalogue' ? ['women', 'womens', 'ladies'] : [], pct: 20, price: 0, on: true }].slice(0, 24) }));
  async function act(i, action) {
    const g = cleanGroup(cfg.groups[i]);
    if (!g) { setInfo((x) => ({ ...x, [i]: 'Give the group a name first.' })); return; }
    if (action === 'apply' && !window.confirm(`Change the REAL prices of every matching live product to a deal (${g.price ? `Rs ${g.price}` : `${g.pct}% off`})? You can undo it.`)) return;
    setBusy(true); setInfo((x) => ({ ...x, [i]: 'Working...' }));
    try {
      const token = await authClient().currentUser.getIdToken();
      const r = await fetch('/api/admin/deal-groups', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, group: g, id: g.id }) });
      const j = await r.json();
      let text;
      if (!j.ok) text = j.error || 'Could not finish.';
      else if (action === 'preview') text = `${j.count} live product(s) would change.${(j.sample || []).map((x) => ` ${x.name}: Rs ${x.from} to Rs ${x.to}.`).join('')}${j.skippedCount ? ` ${j.skippedCount} would be skipped (${(j.skipped || []).slice(0, 2).join('; ')}).` : ''}`;
      else text = j.summary || 'Done.';
      setInfo((x) => ({ ...x, [i]: text }));
      if (j.ok && action !== 'preview') { await setDoc(doc(dbClient(), DEALS_DOC.collection, DEALS_DOC.id), { ...cleanDeals({ ...cfg, pinned }), updatedAtMs: Date.now() }); await revalidateSite(undefined, ['deals-config']); }
    } catch (e) { setInfo((x) => ({ ...x, [i]: `Could not finish: ${e.message}` })); }
    setBusy(false);
  }
  const copy = async () => { try { await navigator.clipboard.writeText(link); setMsg('Link copied.'); } catch { setMsg(link); } };

  return (
    <div className="min-w-0 space-y-6">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold"><Flame className="text-saffron" /> Deals page</h1>
      {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm text-cream">{msg}</p>}

      <section className="card space-y-2">
        <h2 className="text-lg font-extrabold">Your one deals link</h2>
        <p className="break-all rounded-xl bg-raised p-3 font-mono text-sm">{link}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copy} className="btn-ghost !px-4 !py-2 text-sm"><Copy size={15} /> Copy link</button>
          <Link href="/deals" target="_blank" className="btn-ghost !px-4 !py-2 text-sm"><ExternalLink size={15} /> Open</Link>
        </div>
        <p className="text-xs text-dim">Every in-stock product whose price is under its old price (compare price) appears here by itself, live products and catalogue-file products together, biggest discount first. Share this one link on WhatsApp, Facebook, Instagram and TikTok.</p>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-extrabold">Deal groups: one rate for a whole catalogue</h2>
        <p className="text-xs text-dim">Make a group by words (for example Shirts = shirt, tshirt), give it ONE rate (a percent off, or one fixed price such as Rs 999) and press Apply. Every matching live product becomes a deal (old price struck through) and appears in the home feed "Hot deals" and on /deals. Undo puts the old prices back. Whole words only ("men" does not match "women"). Products of the file catalogue (import files) are not changed here.</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(([n, w]) => <button key={n} type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => addGroup(n, w)}><Plus size={13} /> {n}</button>)}
          <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => addGroup()}><Plus size={13} /> Other</button>
        </div>
        {cfg.groups.map((g, i) => (
          <div key={g.id} className="space-y-2 rounded-xl border border-line bg-surface p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-sm"><span className="label">Group name</span><input className="input" maxLength={40} value={g.name} onChange={(e) => setGroup(i, { name: e.target.value })} /></label>
              <label className="block text-sm"><span className="label">Words (comma separated)</span><input className="input" value={(g.words || []).join(', ')} onChange={(e) => setGroup(i, { words: e.target.value.split(',').map((w) => w.trim()).filter(Boolean) })} /></label>
              <label className="block text-sm"><span className="label">Not these words (optional)</span><input className="input" value={(g.exclude || []).join(', ')} onChange={(e) => setGroup(i, { exclude: e.target.value.split(',').map((w) => w.trim()).filter(Boolean) })} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm"><span className="label">Percent off</span><input type="number" min={0} max={80} className="input" value={g.price ? 0 : g.pct} onChange={(e) => setGroup(i, { pct: Number(e.target.value) || 0, price: 0 })} /></label>
                <label className="block text-sm"><span className="label">or fixed price Rs</span><input type="number" min={0} className="input" value={g.price || ''} placeholder="0" onChange={(e) => setGroup(i, { price: Number(e.target.value) || 0, pct: 0 })} /></label>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => act(i, 'preview')}>Preview</button>
              <button type="button" className="btn-gold !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => act(i, 'apply')}>Apply deal</button>
              <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => act(i, 'undo')}>Undo</button>
              <button type="button" className="ml-auto text-red-600" aria-label="Remove group" onClick={() => setCfg((c) => ({ ...c, groups: c.groups.filter((_, n) => n !== i) }))}><Trash2 size={17} /></button>
            </div>
            {info[i] && <p role="status" className="rounded-lg bg-raised p-2 text-xs text-cream">{info[i]}</p>}
          </div>
        ))}
        {!cfg.groups.length && <p className="text-sm text-dim">No group yet. Tap Shirts, Shoes, Pants, Watches or Mens catalogue above.</p>}
        <p className="text-xs text-dim">Remember to press Save below to keep the groups in the list.</p>
      </section>

      <section className="card space-y-3">
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#0B6B45]" checked={cfg.enabled} onChange={(e) => set('enabled', e.target.checked)} /> <b>Deals page is on</b></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm"><span className="label">Title</span><input className="input" maxLength={60} value={cfg.title} onChange={(e) => set('title', e.target.value)} /></label>
          <label className="block text-sm"><span className="label">Badge text</span><input className="input" maxLength={24} value={cfg.badge} onChange={(e) => set('badge', e.target.value)} /></label>
          <label className="block text-sm sm:col-span-2"><span className="label">Sub-title</span><input className="input" maxLength={160} value={cfg.subtitle} onChange={(e) => set('subtitle', e.target.value)} /></label>
          <label className="block text-sm"><span className="label">Smallest discount that counts as a deal (%)</span><input type="number" min={1} max={90} className="input" value={cfg.minPct} onChange={(e) => set('minPct', Number(e.target.value) || 5)} /></label>
          <label className="block text-sm"><span className="label">Countdown: deals end at (optional)</span><input type="datetime-local" className="input" value={toLocal(cfg.endsAtMs)} onChange={(e) => set('endsAtMs', e.target.value ? new Date(e.target.value).getTime() : 0)} /></label>
        </div>
        <label className="block text-sm"><span className="label">Hot picks: product slugs shown first (one per line)</span>
          <textarea className="input" rows={4} value={pinned} onChange={(e) => setPinned(e.target.value)} placeholder="men-leather-wallet-black" /></label>
        <p className="text-xs text-dim">The countdown is only a banner: it does not change any price. A real, automatic price end is the "sale ends" option on the product.</p>
        <button type="button" className="btn-gold" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save'}</button>
      </section>
    </div>
  );
}
