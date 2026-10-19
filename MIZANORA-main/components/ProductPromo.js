'use client';
import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { Tag } from 'lucide-react';
import { dbClient } from '@/lib/firebase-client';
import { formatPKR } from '@/lib/format';

// Admin only. Promo codes that work ONLY on this one product. The customer must type the code at checkout;
// nothing is applied automatically. (All codes, with full reports, are in Admin > Promo codes.)
const EMPTY = { code: '', owner: '', type: 'percent', value: '' };

export default function ProductPromo({ slug, name }) {
  const [codes, setCodes] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const snap = await getDocs(query(collection(dbClient(), 'coupons'), where('productIds', 'array-contains', slug)));
    setCodes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, [slug]);
  useEffect(() => { setCodes(null); setMsg(''); load().catch((e) => { setCodes([]); setMsg(e.message); }); }, [load]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const noEnter = (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };

  async function add() {
    const code = f.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);
    const value = Number(f.value);
    if (!code) { setMsg('Enter a promo code.'); return; }
    if (!f.owner.trim()) { setMsg('Enter the partner name this code belongs to.'); return; }
    if (!(value > 0) || (f.type === 'percent' && value > 90)) { setMsg('Enter a valid discount (percent can be at most 90).'); return; }
    setBusy(true); setMsg('');
    try {
      const exists = await getDoc(doc(dbClient(), 'coupons', code));
      if (exists.exists()) { setMsg('This code already exists. Pick another code, or edit it in Admin > Promo codes.'); setBusy(false); return; }
      await setDoc(doc(dbClient(), 'coupons', code), {
        code, owner: f.owner.trim(), ownerContact: '', type: f.type, value, minOrder: 0, maxDiscount: 0, usageLimit: 0, expiresAtMs: 0,
        commissionPct: 0, productIds: [slug], oncePerPhone: false, active: true, used: 0, revenue: 0, discountTotal: 0, createdAtMs: Date.now(), updatedAtMs: Date.now(),
      });
      setF(EMPTY); setMsg(`Promo code ${code} created for ${name || slug}.`); await load();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  }
  const toggle = (c) => setDoc(doc(dbClient(), 'coupons', c.id), { active: c.active === false }, { merge: true }).then(load).catch((e) => setMsg(e.message));
  const remove = (c) => { if (confirm(`Delete promo code ${c.id}?`)) deleteDoc(doc(dbClient(), 'coupons', c.id)).then(load).catch((e) => setMsg(e.message)); };

  return (
    <div className="rounded-2xl border border-saffron/50 bg-saffron/10 p-3">
      <p className="flex items-center gap-1.5 text-sm font-bold text-cream"><Tag size={16} className="text-gold" /> Promo codes for this product</p>
      <p className="mt-0.5 text-xs text-dim">These codes work only on this product. The customer types the code at checkout.</p>
      {codes === null ? <p className="mt-2 text-xs text-faint">Loading...</p> : codes.length === 0 ? <p className="mt-2 text-xs text-faint">No promo code for this product yet.</p> : (
        <ul className="mt-2 space-y-1.5">
          {codes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2 text-xs">
              <b className="rounded-md bg-gold px-2 py-0.5 font-mono text-white">{c.id}</b>
              <span className="min-w-0 flex-1">{c.owner} · {c.type === 'percent' ? `${c.value}% off` : `${formatPKR(c.value)} off`} · {Number(c.used) || 0} order(s){c.active === false ? ' · OFF' : ''}</span>
              <button type="button" className="font-bold text-gold" onClick={() => toggle(c)}>{c.active === false ? 'Turn on' : 'Turn off'}</button>
              <button type="button" className="font-bold text-red-700" onClick={() => remove(c)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <input className="input !py-2 text-sm uppercase" value={f.code} onChange={set('code')} onKeyDown={noEnter} placeholder="Code e.g. AHMED10" aria-label="Promo code" />
        <input className="input !py-2 text-sm" value={f.owner} onChange={set('owner')} onKeyDown={noEnter} placeholder="Partner name" aria-label="Partner name" />
        <select className="input !py-2 text-sm" value={f.type} onChange={set('type')} aria-label="Discount type"><option value="percent">Percent %</option><option value="flat">Flat Rs.</option></select>
        <input type="number" min="1" className="input !py-2 text-sm" value={f.value} onChange={set('value')} onKeyDown={noEnter} placeholder="Discount" aria-label="Discount value" />
      </div>
      <button type="button" onClick={add} disabled={busy} className="btn-gold mt-2 w-full !py-2.5 text-sm">{busy ? 'Saving...' : 'Add promo code for this product'}</button>
      {msg && <p role="status" className="mt-2 text-xs text-dim">{msg}</p>}
    </div>
  );
}
