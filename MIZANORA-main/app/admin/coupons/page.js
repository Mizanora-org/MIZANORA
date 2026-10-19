'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, limit, query, setDoc, where } from 'firebase/firestore';
import { Copy, FileDown, Pencil, Trash2, Users } from 'lucide-react';
import { dbClient } from '@/lib/firebase-client';
import { readCache, writeCache } from '@/lib/admin-cache';
import { formatDate, formatPKR } from '@/lib/format';
import { downloadCsv, ordersToCsv } from '@/lib/csv';

const EMPTY = { code: '', owner: '', ownerContact: '', type: 'percent', value: '', minOrder: '', maxDiscount: '', usageLimit: '', expires: '', commissionPct: '', productIds: [], oncePerPhone: false, active: true };
const num = (v) => Number(v) || 0;
const copy = async (text, setMsg, what) => { try { await navigator.clipboard.writeText(text); setMsg(`${what} copied.`); } catch { setMsg(text); } };

export default function AdminPromo() {
  const [list, setList] = useState(null);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState('');
  const [pq, setPq] = useState('');
  const [report, setReport] = useState(null); // { code, orders, error }
  const [rp, setRp] = useState('all');

  const load = useCallback(async () => {
    const snap = await getDocs(collection(dbClient(), 'coupons'));
    setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.lastUsedAtMs || 0) - (a.lastUsedAtMs || 0) || a.id.localeCompare(b.id)));
  }, []);
  const loadProducts = useCallback(async () => {
    let prods = readCache('products');
    if (!prods) {
      const p = await getDocs(collection(dbClient(), 'products'));
      prods = p.docs.map((d) => ({ id: d.id, ...d.data() }));
      writeCache('products', prods);
    }
    setProducts(prods.map((x) => ({ id: x.id, name: x.name || x.id })).sort((a, b) => String(a.name).localeCompare(String(b.name))));
  }, []);
  useEffect(() => {
    load().catch((e) => { setList([]); setMsg(e.code === 'permission-denied' ? 'Publish the updated firestore.rules first (it adds the coupons section).' : e.message); });
    loadProducts().catch(() => {});
  }, [load, loadProducts]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const nameOf = useCallback((id) => (products.find((p) => p.id === id) || {}).name || id, [products]);
  const toggleProduct = (id) => setForm((f) => ({ ...f, productIds: f.productIds.includes(id) ? f.productIds.filter((x) => x !== id) : [...f.productIds, id] }));

  async function save(e) {
    e.preventDefault();
    const code = form.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);
    const value = Number(form.value);
    if (!code) { setMsg('Enter a promo code.'); return; }
    if (!form.owner.trim()) { setMsg('Enter the name of the person this promo code belongs to.'); return; }
    if (!(value > 0)) { setMsg('Enter a discount value.'); return; }
    if (form.type === 'percent' && value > 90) { setMsg('Percent discount can be at most 90.'); return; }
    const old = (list || []).find((c) => c.id === code);
    if (!editing && old) { setMsg('This code already exists. Edit it from the list.'); return; }
    try {
      // merge: true keeps the live counters (orders, sales, per-product numbers) when you edit a code
      await setDoc(doc(dbClient(), 'coupons', code), {
        code, owner: form.owner.trim(), ownerContact: form.ownerContact.trim(), type: form.type, value,
        minOrder: num(form.minOrder), maxDiscount: num(form.maxDiscount), usageLimit: num(form.usageLimit),
        expiresAtMs: form.expires ? new Date(`${form.expires}T23:59:59`).getTime() : 0,
        commissionPct: Math.min(100, num(form.commissionPct)), productIds: form.productIds, oncePerPhone: Boolean(form.oncePerPhone),
        active: Boolean(form.active), updatedAtMs: Date.now(), ...(old ? {} : { used: 0, revenue: 0, discountTotal: 0, createdAtMs: Date.now() }),
      }, { merge: true });
      setForm(EMPTY); setEditing(false); setMsg(`Promo code ${code} saved.`); await load();
    } catch (e2) { setMsg(e2.message); }
  }

  const edit = (c) => {
    setEditing(true);
    setForm({
      ...EMPTY, code: c.id, owner: c.owner || '', ownerContact: c.ownerContact || '', type: c.type || 'percent', value: c.value || '', minOrder: c.minOrder || '', maxDiscount: c.maxDiscount || '',
      usageLimit: c.usageLimit || '', expires: c.expiresAtMs ? new Date(c.expiresAtMs).toISOString().slice(0, 10) : '', commissionPct: c.commissionPct || '',
      productIds: Array.isArray(c.productIds) ? c.productIds : [], oncePerPhone: Boolean(c.oncePerPhone), active: c.active !== false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const toggleActive = (c) => setDoc(doc(dbClient(), 'coupons', c.id), { active: c.active === false }, { merge: true }).then(() => setList((cur) => cur.map((x) => (x.id === c.id ? { ...x, active: c.active === false } : x))));
  const remove = (c) => { if (confirm(`Delete promo code ${c.id}? Past orders keep their promo information.`)) deleteDoc(doc(dbClient(), 'coupons', c.id)).then(() => setList((cur) => cur.filter((x) => x.id !== c.id))); };

  async function openReport(c) {
    if (report && report.code === c.id) { setReport(null); return; }
    setRp('all');
    setReport({ code: c.id, orders: null });
    try {
      const snap = await getDocs(query(collection(dbClient(), 'orders'), where('couponCode', '==', c.id), limit(300)));
      setReport({ code: c.id, orders: snap.docs.map((d) => ({ ...d.data(), orderId: d.id })).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)) });
    } catch (e) { setReport({ code: c.id, orders: [], error: e.message }); }
  }

  const totals = useMemo(() => (list || []).reduce((t, c) => ({ orders: t.orders + num(c.used), sales: t.sales + num(c.revenue), disc: t.disc + num(c.discountTotal), comm: t.comm + (num(c.revenue) * num(c.commissionPct)) / 100 }), { orders: 0, sales: 0, disc: 0, comm: 0 }), [list]);
  const shownProducts = products.filter((p) => !pq.trim() || p.name.toLowerCase().includes(pq.trim().toLowerCase()));

  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-[1fr_24rem]">
      <section className="min-w-0">
        <h1 className="mb-1 text-3xl font-extrabold">Promo codes</h1>
        <p className="mb-4 text-sm text-dim">Give every partner (influencer, friend, reseller) their own code and discount. You see who ordered with it, how much was sold and what the partner earned. A code can work on the whole shop or only on chosen products.</p>
        {msg && <p role="status" className="mb-3 rounded-xl bg-raised p-3 text-sm">{msg}</p>}

        {list && list.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[['Promo orders', totals.orders], ['Sales via promo', formatPKR(totals.sales)], ['Discount given', formatPKR(totals.disc)], ['Partner earnings', formatPKR(Math.round(totals.comm))]].map(([l, v]) => (
              <div key={l} className="card !p-3"><p className="text-xs text-faint">{l}</p><p className="text-lg font-extrabold text-gold">{v}</p></div>
            ))}
          </div>
        )}

        {!list ? <p className="text-dim">Loading...</p> : list.length === 0 ? <p className="card text-center text-dim">No promo codes yet. Create the first one on the right, for example AHMED10 for Ahmed.</p> : (
          <ul className="space-y-3">
            {list.map((c) => {
              const earn = Math.round((num(c.revenue) * num(c.commissionPct)) / 100);
              const scope = Array.isArray(c.productIds) ? c.productIds : [];
              const isOpen = report && report.code === c.id;
              return (
                <li key={c.id} className="card !p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
                        <span className="rounded-lg bg-gold px-2.5 py-0.5 font-mono text-base tracking-wide text-white">{c.id}</span>
                        {c.active === false && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-700">OFF</span>}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-cream"><Users size={15} className="text-gold" /> {c.owner || 'No owner name'}{c.ownerContact ? <span className="font-normal text-dim"> · {c.ownerContact}</span> : null}</p>
                      <p className="mt-1 text-sm text-dim">
                        {c.type === 'percent' ? `${c.value}% off` : `${formatPKR(c.value)} off`}
                        {c.minOrder ? ` · min ${formatPKR(c.minOrder)}` : ''}{c.maxDiscount ? ` · max ${formatPKR(c.maxDiscount)}` : ''}
                        {c.usageLimit ? ` · limit ${c.usageLimit}` : ''}{c.oncePerPhone ? ' · once per phone' : ''}
                        {c.expiresAtMs ? ` · until ${new Date(c.expiresAtMs).toLocaleDateString()}` : ''}{c.commissionPct ? ` · partner gets ${c.commissionPct}%` : ''}
                      </p>
                      <p className="mt-1 text-xs text-faint">{scope.length ? `Only on: ${scope.map(nameOf).join(', ')}` : 'Works on all products'}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => copy(c.id, setMsg, 'Code')}><Copy size={14} /> Code</button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                    {[['Orders', num(c.used)], ['Sales', formatPKR(num(c.revenue))], ['Discount given', formatPKR(num(c.discountTotal))], ['Partner earned', c.commissionPct ? formatPKR(earn) : '-']].map(([l, v]) => (
                      <div key={l} className="rounded-xl bg-raised p-2"><p className="text-[0.7rem] text-faint">{l}</p><p className="font-bold">{v}</p></div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    <button className="btn-gold !px-4 !py-2 text-sm" onClick={() => openReport(c)}>{isOpen ? 'Hide orders' : 'Who ordered?'}</button>
                    <button className="btn-ghost !px-3 !py-2 text-sm" onClick={() => edit(c)}><Pencil size={14} /> Edit</button>
                    <button className="btn-ghost !px-3 !py-2 text-sm" onClick={() => toggleActive(c)}>{c.active === false ? 'Turn on' : 'Turn off'}</button>
                    <button className="px-2 text-red-700" aria-label={`Delete ${c.id}`} onClick={() => remove(c)}><Trash2 size={16} /></button>
                  </div>

                  {isOpen && <Report c={c} report={report} rp={rp} setRp={setRp} nameOf={nameOf} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <form onSubmit={save} className="card h-fit min-w-0 space-y-3 lg:sticky lg:top-24">
        <h2 className="text-xl font-bold">{editing ? `Edit ${form.code}` : 'New promo code'}</h2>
        <div><label className="label" htmlFor="cc">Promo code</label><input id="cc" className="input uppercase" value={form.code} onChange={set('code')} placeholder="AHMED10" disabled={editing} required /></div>
        <div><label className="label" htmlFor="co">Belongs to (partner name)</label><input id="co" className="input" value={form.owner} onChange={set('owner')} placeholder="e.g. Ahmed (Instagram)" required /></div>
        <div><label className="label" htmlFor="cn">Partner phone / note (optional)</label><input id="cn" className="input" value={form.ownerContact} onChange={set('ownerContact')} placeholder="0300... or @handle" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="ct">Discount type</label><select id="ct" className="input" value={form.type} onChange={set('type')}><option value="percent">Percent %</option><option value="flat">Flat Rs.</option></select></div>
          <div><label className="label" htmlFor="cv">Discount value</label><input id="cv" type="number" min="1" className="input" value={form.value} onChange={set('value')} required /></div>
          <div><label className="label" htmlFor="cm">Min order (Rs.)</label><input id="cm" type="number" min="0" className="input" value={form.minOrder} onChange={set('minOrder')} /></div>
          <div><label className="label" htmlFor="cx">Max discount (Rs.)</label><input id="cx" type="number" min="0" className="input" value={form.maxDiscount} onChange={set('maxDiscount')} /></div>
          <div><label className="label" htmlFor="cu">Use limit</label><input id="cu" type="number" min="0" className="input" value={form.usageLimit} onChange={set('usageLimit')} placeholder="0 = no limit" /></div>
          <div><label className="label" htmlFor="ce">Expires</label><input id="ce" type="date" className="input" value={form.expires} onChange={set('expires')} /></div>
        </div>
        <div><label className="label" htmlFor="cp">Partner commission %</label><input id="cp" type="number" min="0" max="100" className="input" value={form.commissionPct} onChange={set('commissionPct')} placeholder="e.g. 5 (only for your records)" /></div>

        <fieldset>
          <legend className="label">Works on {form.productIds.length ? `${form.productIds.length} chosen product(s)` : 'ALL products'}</legend>
          <input className="input !py-2 text-sm" value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Search products..." aria-label="Search products" />
          <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
            {shownProducts.length === 0 && <p className="p-2 text-xs text-faint">{products.length ? 'No match.' : 'Add products first (or open the Products tab once).'}</p>}
            {shownProducts.map((p) => (
              <label key={p.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-raised"><input type="checkbox" checked={form.productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} className="h-4 w-4 accent-[#0B6B45]" /><span className="truncate">{p.name}</span></label>
            ))}
          </div>
          <p className="mt-1 text-xs text-faint">Tick nothing = the code works on the whole shop. Tick products = the discount applies only to those products.</p>
        </fieldset>

        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.oncePerPhone} onChange={set('oncePerPhone')} className="h-4 w-4 accent-[#0B6B45]" /> One order per phone number</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={set('active')} className="h-4 w-4 accent-[#0B6B45]" /> Active</label>
        <div className="flex gap-3">
          <button className="btn-gold flex-1">{editing ? 'Save changes' : 'Create promo code'}</button>
          {editing && <button type="button" className="btn-ghost" onClick={() => { setForm(EMPTY); setEditing(false); }}>Cancel</button>}
        </div>
      </form>
    </div>
  );
}

function Report({ c, report, rp, setRp, nameOf }) {
  const orders = report.orders;
  const valid = useMemo(() => (orders || []).filter((o) => o.status !== 'Cancelled'), [orders]);
  const perProduct = useMemo(() => {
    const m = new Map();
    for (const o of valid) {
      const lines = Array.isArray(o.couponLines) && o.couponLines.length ? o.couponLines : (o.items || []).map((i) => ({ id: i.id, qty: i.qty, amount: i.price * i.qty }));
      for (const l of lines) { const x = m.get(l.id) || { id: l.id, qty: 0, amount: 0, orders: 0 }; x.qty += l.qty; x.amount += l.amount; x.orders += 1; m.set(l.id, x); }
    }
    return [...m.values()].sort((a, b) => b.qty - a.qty);
  }, [valid]);
  const shown = (orders || []).filter((o) => rp === 'all' || (o.items || []).some((i) => i.id === rp));
  const nm = (id) => { const f = (orders || []).flatMap((o) => o.items || []).find((i) => i.id === id); return (f && f.name) || nameOf(id); };

  if (!orders) return <p className="mt-4 text-sm text-dim">Loading orders...</p>;
  return (
    <div className="mt-4 space-y-4 border-t border-line pt-4 text-sm">
      {report.error && <p className="text-red-700">{report.error}</p>}
      {orders.length === 0 ? <p className="text-dim">Nobody has ordered with {c.id} yet.</p> : (
        <>
          <div>
            <p className="mb-2 font-bold text-cream">Per product ({valid.length} valid orders, cancelled ones excluded)</p>
            <div className="overflow-x-auto"><table className="w-full min-w-[22rem] text-left text-xs">
              <thead className="text-faint"><tr><th className="py-1 pr-2">Product</th><th className="pr-2">Orders</th><th className="pr-2">Qty</th><th>Sales (before discount)</th></tr></thead>
              <tbody>{perProduct.map((p) => <tr key={p.id} className="border-t border-line"><td className="py-1.5 pr-2 font-semibold">{nm(p.id)}</td><td className="pr-2">{p.orders}</td><td className="pr-2">{p.qty}</td><td>{formatPKR(p.amount)}</td></tr>)}</tbody>
            </table></div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <label className="label" htmlFor={`rp-${c.id}`}>Show orders for product</label>
              <select id={`rp-${c.id}`} className="input !py-2" value={rp} onChange={(e) => setRp(e.target.value)}>
                <option value="all">All products</option>
                {perProduct.map((p) => <option key={p.id} value={p.id}>{nm(p.id)}</option>)}
              </select>
            </div>
            <button className="btn-ghost !px-4 !py-2 text-sm" onClick={() => downloadCsv(`promo-${c.id}-${new Date().toISOString().slice(0, 10)}.csv`, ordersToCsv(shown))}><FileDown size={16} /> Export {shown.length} to CSV</button>
          </div>

          <ul className="space-y-2">
            {shown.map((o) => (
              <li key={o.orderId} className="rounded-xl bg-raised p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-cream">{o.customer?.name} · {o.customer?.phone}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${o.status === 'Cancelled' ? 'bg-red-500/15 text-red-700' : o.status === 'Dispatched' ? 'bg-green-500/15 text-green-800' : 'bg-yellow-500/15 text-yellow-800'}`}>{o.status}</span>
                </div>
                <p className="text-xs text-dim">{o.orderId} · {formatDate(o.createdAtMs)} · {o.customer?.city}</p>
                <p className="mt-1 text-xs text-dim">{(o.items || []).map((i) => `${i.name}${i.size ? ` (${i.size})` : ''} x${i.qty}`).join(', ')}</p>
                <p className="mt-1 text-xs"><b className="text-gold">{formatPKR(o.total)}</b> · discount {formatPKR(o.discount)}</p>
              </li>
            ))}
          </ul>
          {orders.length >= 300 && <p className="text-xs text-faint">Showing the latest 300 orders.</p>}
        </>
      )}
    </div>
  );
}
