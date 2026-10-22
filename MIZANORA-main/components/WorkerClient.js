'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { BadgePercent, Clock, Copy, Download, Lock, MessageCircle, Package, Search, Send, Wallet, XCircle } from 'lucide-react';
import { authClient, dbClient, firebaseConfigured } from '@/lib/firebase-client';
import { formatDate, formatPKR } from '@/lib/format';
import { DEFAULT_SETTINGS, MIN_PAYOUT, TIERS, bandPct, deliveryRate, effectiveTier, eligible, isAvailable, isHolding, lineEarning, maxMarkupFor, sellView } from '@/lib/workers';
import { SITE, waLink } from '@/lib/config';
import { useAuth } from './AuthProvider';
import WorkerApply from './WorkerApply';
import WorkerPublicProfile from './WorkerPublicProfile';

const STATUS = { pending: 'bg-yellow-500/15 text-yellow-800', holding: 'bg-sky-500/15 text-sky-800', approved: 'bg-emerald-600/20 text-emerald-900', requested: 'bg-blue-500/15 text-blue-800', paid: 'bg-green-600/20 text-green-900', cancelled: 'bg-red-500/15 text-red-700' };
const LABEL = { pending: 'Waiting for delivery', holding: 'Delivered: releasing to wallet', approved: 'In wallet', requested: 'Payout requested', paid: 'Paid', cancelled: 'Cancelled' };
const link = (code, id) => `${SITE.url}${id ? `/product/${id}` : ''}?ref=${code}`;
const effStatus = (c, now = Date.now()) => (c.status === 'holding' && isAvailable(c, now) ? 'approved' : c.status);
const token = () => authClient().currentUser.getIdToken();

async function copy(text, setMsg) { try { await navigator.clipboard.writeText(text); setMsg('Copied.'); } catch { setMsg(text); } setTimeout(() => setMsg(''), 2500); }

async function saveImage(url, name) {
  try {
    const b = await (await fetch(url)).blob();
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${name}.jpg`; document.body.appendChild(a); a.click(); a.remove();
  } catch { window.open(url, '_blank', 'noopener'); } // some image hosts block direct download: open it so it can be saved by long-press
}

function Money({ label, value, tone }) {
  return <div className="card !p-4"><p className="text-xs font-semibold text-dim">{label}</p><p className={`mt-1 text-xl font-extrabold ${tone || 'text-gold'}`}>{formatPKR(value)}</p></div>;
}

function Overview({ w, comm, settings }) {
  const [msg, setMsg] = useState('');
  const t = effectiveTier(w);
  const idx = TIERS.findIndex((x) => x.key === w.tierKey);
  const next = TIERS[idx + 1];
  const s = w.stats || {}, dr = deliveryRate(s);
  const now = Date.now();
  const sum = (st) => comm.filter((c) => effStatus(c, now) === st).reduce((a, c) => a + (c.amount || 0), 0);
  const main = link(w.code, '');
  return (
    <div className="space-y-4">
      <div className="card bg-gradient-to-br from-[#0B6B45] to-[#073D28] !border-0 text-white">
        <p className="text-sm text-white/80">Your level</p>
        <p className="font-display text-3xl font-extrabold">{t.name} · {t.rate}%</p>
        <p className="mt-1 text-sm text-white/85">{t.maxPrice ? `Earn on products up to ${formatPKR(t.maxPrice)} each` : 'Earn on every product'}{t.custom ? '' : ''}</p>
        {next && <p className="mt-3 rounded-xl bg-white/10 p-3 text-sm">Next: <b>{next.name} ({next.rate}%)</b>. Needs {next.needs.delivered} delivered orders and {next.needs.rate}% delivery rate. You have {s.delivered || 0} delivered and {dr}% delivery rate.</p>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Money label="Wallet (available now)" value={sum('approved')} />
        <Money label="Delivered, releasing soon" value={sum('holding')} tone="text-sky-700" />
        <Money label="Waiting for delivery" value={sum('pending')} tone="text-yellow-700" />
        <Money label="Payout requested" value={sum('requested')} tone="text-blue-700" />
        <Money label="Paid to you" value={sum('paid')} tone="text-green-700" />
      </div>
      <div className="grid grid-cols-2 gap-3 text-center text-sm sm:grid-cols-4">
        {[['Link visits', s.clicks || 0], ['Orders', s.orders || 0], ['Delivered', s.delivered || 0], ['Delivery rate', `${dr}%`]].map(([a, b]) => <div key={a} className="card !p-3"><p className="text-lg font-extrabold">{b}</p><p className="text-xs text-dim">{a}</p></div>)}
      </div>
      <div className="card space-y-3">
        <p className="font-bold">Your shop link</p>
        <p className="break-all rounded-xl bg-raised p-3 text-sm">{main}</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-gold !py-2.5" onClick={() => copy(main, setMsg)}><Copy size={16} /> Copy link</button>
          <a className="btn-wa !py-2.5" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Mizanora online shop, cash on delivery across Pakistan: ${main}`)}`}><MessageCircle size={16} /> Share on WhatsApp</a>
        </div>
        {msg && <p role="status" className="text-sm font-semibold text-gold">{msg}</p>}
        <p className="text-xs text-dim">{settings.repeatCredit ? `Customers who first order through your link stay yours: their repeat orders earn you commission for ${settings.repeatDays} days. ` : ''}Anyone who opens your link and orders within 30 days counts for you. You earn only when the order is delivered. Orders with a promo code, and orders you place for yourself, earn no commission.</p>
      </div>
    </div>
  );
}

function ProductRow({ p, w, t, onSaved }) {
  const [msg, setMsg] = useState('');
  const mx = maxMarkupFor(p.price);
  const pct = bandPct(p.price);
  const saved = Number((w.markups || {})[p.id]) || 0;
  const [sell, setSell] = useState(String(p.price + saved));          // the price the worker's customers pay
  const [mkt, setMkt] = useState(String((w.market || {})[p.id] || '')); // the market rate (struck through when higher)
  const ok = eligible(t, p.price);
  const need = TIERS.find((x) => !x.maxPrice || x.maxPrice >= p.price);
  const sellN = Math.round(Number(sell) || 0);
  const markup = Math.min(Math.max(0, sellN - p.price), mx);
  const e = lineEarning(t, p.price, 1, markup, { affOn: true, affRate: p.affRate });
  const view = sellView(p.price, markup, Number(mkt) || 0);
  const bad = sellN && (sellN < p.price || sellN > p.price + mx);
  const url = link(w.code, p.id);
  const caption = `${p.name}\nPrice: ${formatPKR(view.sell)}${view.off ? ` (market rate ${formatPKR(view.market)}, ${view.off}% off)` : ''} | Cash on delivery across Pakistan\nOrder here: ${url}`;
  async function save() {
    setMsg('');
    const r = await fetch('/api/worker/markups', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ productId: p.id, sell: sellN || p.price, market: Number(mkt) || 0 }) });
    const d = await r.json().catch(() => ({}));
    setMsg(d.ok ? 'Saved. Customers on your link now see these prices.' : d.error || 'Could not save.'); if (d.ok) onSaved(p.id, d.markup, d.market);
  }
  return (
    <div className="card !p-3">
      <div className="flex gap-3">
        {p.image ? <img src={p.image} alt={p.name} loading="lazy" referrerPolicy="no-referrer" className="h-20 w-20 shrink-0 rounded-xl object-cover" /> : <div className="h-20 w-20 shrink-0 rounded-xl bg-raised" />}
        <div className="min-w-0 flex-1 text-sm">
          <p className="line-clamp-2 font-bold">{p.name}</p>
          <p className="text-dim">Shop price {formatPKR(p.price)}</p>
          {ok ? (
            <>
              <p className="font-bold text-gold">Max profit: {formatPKR(mx)} per piece ({pct}%)</p>
              <p className="text-xs text-dim">Commission {formatPKR(e.commission)} ({e.rate}%){markup ? ` + your price profit ${formatPKR(markup)}` : ''} = <b className="text-cream">{formatPKR(e.total)}</b> per piece</p>
            </>
          ) : <p className="flex items-center gap-1 font-semibold text-faint"><Lock size={14} /> Unlocks at {need ? need.name : 'a higher level'}</p>}
        </div>
      </div>
      {ok && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
          <button type="button" className="btn-ghost !px-3 !py-2" onClick={() => copy(url, setMsg)}><Copy size={15} /> Link</button>
          <button type="button" className="btn-ghost !px-3 !py-2" onClick={() => copy(caption, setMsg)}><Send size={15} /> Caption</button>
          <a className="btn-ghost !px-3 !py-2" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(caption)}`}><MessageCircle size={15} /> WhatsApp</a>
          {p.images.length > 0 && <button type="button" className="btn-ghost !px-3 !py-2" onClick={async () => { let imgs = p.images; try { const d = await (await fetch(`/api/worker/catalog?id=${encodeURIComponent(p.id)}`)).json(); if (d.ok && d.product.images.length) imgs = d.product.images; } catch (_) { /* use the first photo */ } for (let i = 0; i < imgs.length; i++) await saveImage(imgs[i], `${p.id}-${i + 1}`); }}><Download size={15} /> Photos</button>}
          {p.videos.map((v, i) => <a key={v} className="btn-ghost !px-3 !py-2" target="_blank" rel="noopener noreferrer" href={v}><Download size={15} /> Video {i + 1}</a>)}
        </div>
      )}
      {ok && (
        <div className="mt-3 rounded-xl bg-raised/60 p-3 text-sm">
          <p className="mb-2 font-bold">Your prices for customers on your link</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-dim">Your selling price (Rs)</span>
              <input className={`input !py-2 ${bad ? 'input-err' : ''}`} inputMode="numeric" value={sell} onChange={(x) => setSell(x.target.value.replace(/\D/g, ''))} placeholder={`${p.price} - ${p.price + mx}`} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-dim">Market rate (Rs)</span>
              <input className="input !py-2" inputMode="numeric" value={mkt} onChange={(x) => setMkt(x.target.value.replace(/\D/g, ''))} placeholder="Price in other markets" /></label>
          </div>
          <p className="mt-1.5 text-xs text-dim">Selling price can be {formatPKR(p.price)} to {formatPKR(p.price + mx)}. If the market rate is higher than your price, customers see it struck through with the discount. If it is the same or lower, they see only your price.</p>
          <p className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="text-xs font-semibold text-faint">Customer sees:</span>
            <span className="text-lg font-extrabold text-gold">{formatPKR(view.sell)}</span>
            {view.off > 0 && <><span className="text-sm text-faint line-through">{formatPKR(view.market)}</span><span className="rounded-md bg-red-600 px-1.5 py-0.5 text-xs font-extrabold text-white">-{view.off}%</span></>}
          </p>
          {e.rate < pct && <p className="mt-2 text-xs text-faint">Why is commission only {e.rate}%? The shop&apos;s own profit on this product is small, so commission is kept safe. Your real extra profit comes from your selling price, up to {formatPKR(mx)}.</p>}
          <button type="button" className="btn-gold mt-3 !px-5 !py-2" disabled={Boolean(bad)} onClick={save}>Save my prices</button>
        </div>
      )}
      {msg && <p role="status" className="mt-2 text-xs font-semibold text-gold">{msg}</p>}
    </div>
  );
}

function Products({ w, setW }) {
  const [list, setList] = useState(null);
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [only, setOnly] = useState(true);
  const t = effectiveTier(w);
  const max = only && t.maxPrice ? t.maxPrice : 0;
  // The server searches and pages the catalogue (a shop can have 50,000+ products), so this list never gets heavy.
  useEffect(() => {
    let live = true;
    setBusy(true);
    const h = setTimeout(() => {
      fetch(`/api/worker/catalog?q=${encodeURIComponent(q.trim())}&max=${max || ''}`).then((r) => r.json())
        .then((d) => { if (live) { setList(d.products || []); setNext(d.next || ''); } }).catch(() => { if (live) setList([]); }).finally(() => { if (live) setBusy(false); });
    }, q.trim() ? 350 : 0);
    return () => { live = false; clearTimeout(h); };
  }, [q, max]);
  const more = async () => {
    if (!next || busy) return;
    setBusy(true);
    try { const d = await (await fetch(`/api/worker/catalog?max=${max || ''}&cursor=${encodeURIComponent(next)}`)).json(); setList((cur) => { const have = new Set(cur.map((p) => p.id)); return [...cur, ...(d.products || []).filter((p) => !have.has(p.id))]; }); setNext(d.next || ''); } catch (_) { /* try again */ }
    setBusy(false);
  };
  const shown = useMemo(() => (list || []).filter((p) => !only || eligible(t, p.price)).sort((a, b) => Number(eligible(t, b.price)) - Number(eligible(t, a.price))), [list, t, only]);
  if (!list) return <p className="text-dim">Loading products...</p>;
  return (
    <div className="space-y-3">
      <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-faint" /><input className="input !pl-9" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="flex gap-2 text-sm font-semibold">{[[true, 'My eligible products'], [false, 'All products']].map(([v, l]) => <button key={l} type="button" onClick={() => setOnly(v)} className={`rounded-full px-4 py-1.5 ${only === v ? 'bg-gold text-white' : 'bg-raised text-dim'}`}>{l}</button>)}</div>
      <p className="text-xs text-dim">Download photos and videos, copy a ready caption, and share your own link. Only share real photos and honest descriptions.</p>
      {shown.map((p) => <ProductRow key={p.id} p={p} w={w} t={t} onSaved={(id, v, m) => setW((x) => ({ ...x, markups: { ...(x.markups || {}), [id]: v }, market: { ...(x.market || {}), [id]: m } }))} />)}
      {!shown.length && <p className="card text-center text-dim">{busy ? 'Searching...' : 'No products found.'}</p>}
      {next && !q.trim() && <button type="button" className="btn-ghost w-full" disabled={busy} onClick={more}>{busy ? 'Loading...' : 'Show more products'}</button>}
    </div>
  );
}

function Orders({ comm }) {
  if (!comm.length) return <div className="card text-center"><Package className="mx-auto text-faint" size={36} /><p className="mt-2 font-semibold">No orders yet</p><p className="text-sm text-dim">Share your link. Orders show here the moment a customer orders.</p></div>;
  return (
    <div className="space-y-2">
      {comm.map((c) => (
        <div key={c.id} className="card flex items-center justify-between gap-3 !p-4 text-sm">
          <span className="min-w-0"><b className="block">{c.orderId}{c.repeat && <span className="ml-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs text-gold">Repeat customer</span>}</b><span className="text-dim">{c.city} · {formatDate(c.createdAtMs)}</span><span className="block truncate text-faint">{(c.lines || []).filter((l) => l.total).map((l) => `${l.name} x${l.qty}`).join(', ')}</span></span>
          <span className="shrink-0 text-right"><b className="block text-gold">{formatPKR(c.amount)}</b><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS[effStatus(c)] || ''}`}>{LABEL[effStatus(c)] || c.status}</span>{c.status === 'holding' && isHolding(c) && <span className="block text-xs text-dim">Wallet on {formatDate(c.releaseAtMs)}</span>}</span>
        </div>
      ))}
    </div>
  );
}

function Payout({ w, comm, payouts, reload, settings }) {
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const now = Date.now();
  const ready = comm.filter((c) => isAvailable(c, now)).reduce((a, c) => a + (c.amount || 0), 0);
  const hold = comm.filter((c) => isHolding(c, now)).sort((x, y) => x.releaseAtMs - y.releaseAtMs);
  async function ask() {
    setBusy(true); setMsg('');
    const r = await fetch('/api/worker/payout', { method: 'POST', headers: { Authorization: `Bearer ${await token()}` } });
    const d = await r.json().catch(() => ({}));
    setMsg(d.ok ? `Payout of ${formatPKR(d.amount)} requested.` : d.error || 'Could not request payout.'); setBusy(false); if (d.ok) reload();
  }
  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <p className="flex items-center gap-2 font-bold"><Wallet size={18} className="text-gold" /> Wallet balance: {formatPKR(ready)}</p>
        <p className="text-sm text-dim">After a customer receives the order, the commission waits {settings.holdDays} days (the return window) and then moves into your wallet automatically. Minimum payout {formatPKR(MIN_PAYOUT)}. We send it to your {w.payout?.method} ({w.payout?.account}).</p>
        <button type="button" className="btn-gold w-full" disabled={busy || ready < MIN_PAYOUT} onClick={ask}>{busy ? 'Please wait...' : 'Withdraw from wallet'}</button>
        {msg && <p role="status" className="text-sm font-semibold text-gold">{msg}</p>}
      </div>
      {hold.length > 0 && (
        <div className="card space-y-2 !p-4 text-sm">
          <p className="font-bold">Coming to your wallet</p>
          {hold.map((c) => <div key={c.id} className="flex justify-between"><span>{c.orderId} · {formatDate(c.releaseAtMs)}</span><b className="text-sky-700">{formatPKR(c.amount)}</b></div>)}
        </div>
      )}
      {payouts.length > 0 && <p className="font-bold">Payout history</p>}
      {payouts.map((p) => <div key={p.id} className="card flex justify-between !p-4 text-sm"><span>{formatDate(p.requestedAtMs)}</span><b>{formatPKR(p.amount)} · {p.status === 'paid' ? 'Paid' : 'Requested'}</b></div>)}
    </div>
  );
}

export default function WorkerClient() {
  const { user, ready } = useAuth();
  const [w, setW] = useState(undefined); // undefined loading, null no application
  const [comm, setComm] = useState([]); const [payouts, setPayouts] = useState([]);
  const [tab, setTab] = useState('home'); const [err, setErr] = useState('');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const s = await getDoc(doc(dbClient(), 'workers', user.uid));
      setW(s.exists() ? s.data() : null);
      getDoc(doc(dbClient(), 'workerSettings', 'main')).then((x) => x.exists() && setSettings({ ...DEFAULT_SETTINGS, ...x.data() })).catch(() => {});
      if (s.exists() && s.data().status === 'approved') {
        const [c, p] = await Promise.all([
          getDocs(query(collection(dbClient(), 'commissions'), where('workerId', '==', user.uid), limit(200))),
          getDocs(query(collection(dbClient(), 'payouts'), where('workerId', '==', user.uid), limit(50))),
        ]);
        setComm(c.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)));
        setPayouts(p.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.requestedAtMs || 0) - (a.requestedAtMs || 0)));
      }
    } catch (e) { setW(null); setErr(e.code === 'permission-denied' ? 'Publish the updated firestore.rules first (it adds the worker program).' : e.message); }
  }, [user]);
  useEffect(() => { load(); }, [load]);

  if (!firebaseConfigured) return <p className="card text-dim">Accounts are not set up yet.</p>;
  if (!ready) return <p className="text-dim">Loading...</p>;
  if (!user) return <div className="card space-y-3 text-center"><BadgePercent className="mx-auto text-gold" size={36} /><p className="font-bold">Sign in first, then apply</p><p className="text-sm text-dim">Use your Mizanora account (or create one). It takes a minute.</p><Link href="/account" className="btn-gold">Sign in or create account</Link></div>;
  if (w === undefined) return <p className="text-dim">Loading...</p>;
  if (err) return <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>;
  if (!w || w.status === 'rejected') return <WorkerApply user={user} rejectReason={w?.rejectReason} onDone={load} />;
  if (w.status === 'pending') return <div className="card space-y-2 text-center"><Clock className="mx-auto text-gold" size={36} /><p className="text-lg font-bold">Application received</p><p className="text-sm text-dim">We are checking your CNIC and photos. This usually takes 1 to 2 days. Your worker code will be <b>{w.code}</b> once approved.</p></div>;
  if (w.status === 'suspended') return <div className="card space-y-2 text-center"><XCircle className="mx-auto text-red-600" size={36} /><p className="text-lg font-bold">Account paused</p><p className="text-sm text-dim">Please contact support on WhatsApp.</p><a className="btn-wa" href={waLink('Assalam o Alaikum, my worker account is paused.')}>Contact support</a></div>;

  const tabs = [['home', 'Overview'], ['products', 'Products and links'], ['orders', 'My orders'], ['payout', 'Wallet']];
  return (
    <div>
      <div className="no-sb mb-5 flex gap-2 overflow-x-auto" role="tablist">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${tab === k ? 'bg-gold text-white' : 'border border-line bg-surface text-dim'}`}>{l}</button>)}
      </div>
      {tab === 'home' && (<><Overview w={w} comm={comm} settings={settings} /><div className="mt-4"><WorkerPublicProfile worker={w} /></div></>) }
      {tab === 'products' && <Products w={w} setW={setW} />}
      {tab === 'orders' && <Orders comm={comm} />}
      {tab === 'payout' && <Payout w={w} comm={comm} payouts={payouts} reload={load} settings={settings} />}
    </div>
  );
}
