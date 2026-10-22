'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Loader2, X } from 'lucide-react';
import { authClient, dbClient } from '@/lib/firebase-client';
import { catsOf, splitCats } from '@/lib/cats';
import { revalidateSite } from '@/lib/admin-cache';

// The pop-up editor behind the pencil. Loads the product from Firebase, or (for catalogue-file products) from the catalogue files.
// Saves to Firebase at once; a catalogue product is saved as a live copy (live products always win over the file copy). If Firebase
// refuses (limit, rules) a catalogue product is saved into the catalogue files instead.
const lines = (v) => String(v || '').split(/\n/).map((x) => x.trim()).filter(Boolean);

async function authFetch(url, body) {
  const token = await authClient().currentUser.getIdToken();
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || `Error ${r.status}`);
  return j;
}

export default function QuickEditModal({ id, onClose }) {
  const [src, setSrc] = useState('');
  const [base, setBase] = useState(null);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const s = await getDoc(doc(dbClient(), 'products', id));
        let data, from;
        if (s.exists()) { data = s.data(); from = 'live'; } else { const j = await authFetch('/api/admin/archive', { action: 'get', slug: id }); data = j.data; from = 'archive'; }
        if (dead) return;
        setSrc(from); setBase(data);
        setF({ name: data.name || '', price: data.price || '', comparePrice: data.comparePrice || '', category: catsOf(data).join(', '), description: data.description || '', images: (data.images || []).join('\n'), videos: (data.videos || []).join('\n'), inStock: data.inStock !== false, featured: Boolean(data.featured), active: data.active !== false });
      } catch (e) { if (!dead) setMsg((e && e.message) || 'Could not open this product.'); }
    })();
    return () => { dead = true; };
  }, [id]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function save() {
    const price = Number(f.price);
    if (!f.name.trim()) { setMsg('The name is required.'); return; }
    if (!(price > 0)) { setMsg('Enter a valid price.'); return; }
    setBusy(true); setMsg('');
    const cats = splitCats(f.category);
    const edit = { name: f.name.trim(), price, comparePrice: Number(f.comparePrice) || 0, category: cats[0] || '', categories: cats, description: f.description.trim(), images: lines(f.images), videos: lines(f.videos), inStock: Boolean(f.inStock), featured: Boolean(f.featured), active: Boolean(f.active), updatedAt: Date.now() };
    try {
      if (src === 'live') await updateDoc(doc(dbClient(), 'products', id), edit);
      else await setDoc(doc(dbClient(), 'products', id), { ...base, ...edit, createdAt: base.createdAt || Date.now() });
      await revalidateSite(id);
      setDone(true); setMsg('Saved. It is live on the shop now. Refreshing...');
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      if (src === 'archive') {
        try {
          await authFetch('/api/admin/archive-edit', { action: 'save', id, data: { ...base, ...edit } });
          setDone(true); setMsg('Firebase refused it, so it was saved in the catalogue files. The shop shows it after the redeploy (1 to 3 minutes).');
        } catch (e2) { setMsg((e2 && e2.message) || 'Could not save.'); }
      } else setMsg(e && e.code === 'permission-denied' ? 'Permission denied: this account is not the admin in the Firestore rules.' : (e && e.message) || 'Could not save.');
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[120] grid place-items-end bg-black/50 sm:place-items-center" role="dialog" aria-modal="true" aria-label="Edit product" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Edit product</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-2 hover:bg-raised"><X size={20} /></button>
        </div>
        {!f ? (msg ? <p role="alert" className="field-err">{msg}</p> : <p className="flex items-center gap-2 text-dim"><Loader2 size={16} className="animate-spin" /> Opening...</p>) : (
          <div className="space-y-3">
            {src === 'archive' && <p className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900">This product comes from the catalogue files. Saving makes a live copy in Firebase that the shop shows at once.</p>}
            <div><label className="label" htmlFor="qn">Name</label><input id="qn" className="input" value={f.name} onChange={set('name')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="qp">Price (Rs)</label><input id="qp" type="number" min="1" className="input" value={f.price} onChange={set('price')} /></div>
              <div><label className="label" htmlFor="qc">Old price (Rs)</label><input id="qc" type="number" min="0" className="input" value={f.comparePrice} onChange={set('comparePrice')} /></div>
            </div>
            <div><label className="label" htmlFor="qk">Categories (comma separated)</label><input id="qk" className="input" value={f.category} onChange={set('category')} /></div>
            <div><label className="label" htmlFor="qd">Description</label><textarea id="qd" rows={4} className="input" value={f.description} onChange={set('description')} /></div>
            <div>
              <label className="label" htmlFor="qi">Photo links (one per line, the first is the main photo)</label>
              <div className="mb-2 flex flex-wrap gap-2">{lines(f.images).slice(0, 8).map((u, i) => (/* eslint-disable-next-line @next/next/no-img-element */ <img key={u + i} src={u} alt="" referrerPolicy="no-referrer" className="h-14 w-14 rounded-lg bg-raised object-cover" onError={(e) => { e.currentTarget.style.outline = '2px solid #dc2626'; }} />))}</div>
              <textarea id="qi" rows={3} className="input" value={f.images} onChange={set('images')} />
            </div>
            <div><label className="label" htmlFor="qv">Video links (one per line)</label><textarea id="qv" rows={2} className="input" value={f.videos} onChange={set('videos')} placeholder="YouTube, Facebook, Instagram, TikTok, Vimeo, Drive or .mp4 link" /></div>
            <div className="flex flex-wrap gap-4 text-sm">
              {[['inStock', 'In stock'], ['featured', 'Featured on home'], ['active', 'Visible']].map(([k, l]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={Boolean(f[k])} onChange={set(k)} className="h-4 w-4 accent-[#0B6B45]" /> {l}</label>)}
            </div>
            {msg && <p role="status" className={`rounded-xl p-2.5 text-sm ${done ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg}</p>}
            <div className="flex gap-3">
              <button type="button" className="btn-gold flex-1" disabled={busy || done} onClick={save}>{busy ? 'Saving...' : 'Save'}</button>
              <Link href="/admin/products" className="btn-ghost">Full editor</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
