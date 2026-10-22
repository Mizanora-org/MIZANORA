'use client';
import { useCallback, useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { CheckCircle2, Download, Eye, Pause, Wallet, XCircle } from 'lucide-react';
import { dbClient } from '@/lib/firebase-client';
import { formatDate, formatPKR } from '@/lib/format';
import { DEFAULT_SETTINGS, TIERS, deliveryRate, earnedTier, isAvailable, isHolding } from '@/lib/workers';

const BADGE = { pending: 'bg-yellow-500/15 text-yellow-800', approved: 'bg-emerald-600/20 text-emerald-900', rejected: 'bg-red-500/15 text-red-700', suspended: 'bg-orange-500/15 text-orange-800' };

function Worker({ w, reload }) {
  const [kyc, setKyc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rate, setRate] = useState(String(w.rateOverride || ''));
  const s = w.stats || {};
  const patch = async (data) => { setBusy(true); try { await updateDoc(doc(dbClient(), 'workers', w.id), data); await reload(); } catch (e) { alert(e.message); } setBusy(false); };
  const showKyc = async () => { const d = await getDoc(doc(dbClient(), 'workerKyc', w.id)); setKyc(d.exists() ? d.data() : { missing: true }); };
  const earned = earnedTier(s);
  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 text-sm">
          <p className="text-lg font-bold">{w.name} <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${BADGE[w.status] || ''}`}>{w.status}</span></p>
          <p className="text-dim">{w.phone} · {w.city} · {w.email}</p>
          <p className="text-dim">Code <b>{w.code}</b> · Payout: {w.payout?.method} {w.payout?.account} ({w.payout?.title})</p>
          <p className="text-dim">Orders {s.orders || 0} · Delivered {s.delivered || 0} · Returned {s.returned || 0} · Cancelled {s.cancelled || 0} · Delivery rate {deliveryRate(s)}%</p>
          {w.how && <p className="text-faint">Plan: {w.how}</p>}{w.social && <p className="break-all text-faint">{w.social}</p>}
          <p className="text-faint">Applied {formatDate(w.appliedAtMs)}</p>
        </div>
        <button type="button" className="btn-ghost !px-3 !py-2 text-sm" onClick={showKyc}><Eye size={15} /> View CNIC and selfie</button>
      </div>
      {kyc && (kyc.missing ? <p className="text-sm text-red-700">No KYC documents found.</p> : (
        <div className="space-y-2"><p className="text-sm font-semibold">CNIC: {kyc.cnic}</p>
          <div className="grid gap-2 sm:grid-cols-3">{[['Front', kyc.cnicFront], ['Back', kyc.cnicBack], ['Selfie', kyc.selfie]].map(([l, src]) => <a key={l} href={src} target="_blank" rel="noreferrer"><img src={src} alt={l} className="w-full rounded-xl border border-line" /><span className="text-xs text-dim">{l}</span></a>)}</div></div>
      ))}
      <div className="flex flex-wrap gap-2 text-sm font-semibold">
        {w.status !== 'approved' && <button disabled={busy} className="btn-gold !px-4 !py-2" onClick={() => patch({ status: 'approved', approvedAtMs: Date.now() })}><CheckCircle2 size={15} /> Approve</button>}
        {w.status === 'pending' && <button disabled={busy} className="btn-ghost !px-4 !py-2 !border-red-400 !text-red-700" onClick={() => { const r = prompt('Reason (worker will see it):', 'CNIC photo not clear'); if (r) patch({ status: 'rejected', rejectReason: r }); }}><XCircle size={15} /> Reject</button>}
        {w.status === 'approved' && <button disabled={busy} className="btn-ghost !px-4 !py-2" onClick={() => patch({ status: 'suspended' })}><Pause size={15} /> Pause</button>}
      </div>
      {w.status === 'approved' && (
        <div className="grid gap-3 rounded-xl bg-raised p-3 text-sm sm:grid-cols-3">
          <div><label className="label" htmlFor={`t${w.id}`}>Level (auto: {earned.name})</label>
            <select id={`t${w.id}`} className="input !py-2" value={w.tierKey || 'starter'} onChange={(e) => patch({ tierKey: e.target.value, tierLock: true })}>{TIERS.map((t) => <option key={t.key} value={t.key}>{t.name} · {t.rate}%</option>)}</select></div>
          <div><label className="label" htmlFor={`r${w.id}`}>Special rate % (blank = level rate)</label>
            <div className="flex gap-2"><input id={`r${w.id}`} className="input !py-2" inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value.replace(/\D/g, ''))} /><button type="button" className="btn-gold !px-3 !py-2" onClick={() => patch({ rateOverride: Math.min(50, Number(rate) || 0) })}>Set</button></div></div>
          <div className="space-y-1.5"><label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(w.customAllowed)} onChange={(e) => patch({ customAllowed: e.target.checked })} /> Allow own pricing (profit)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(w.tierLock)} onChange={(e) => patch({ tierLock: e.target.checked })} /> Lock level (no auto upgrade)</label></div>
        </div>
      )}
    </div>
  );
}

function Payouts({ list, reload }) {
  const pay = async (p) => {
    if (!confirm(`Mark ${formatPKR(p.amount)} as PAID to ${p.workerName}? Send the money first.`)) return;
    const db = dbClient(); const b = writeBatch(db);
    b.update(doc(db, 'payouts', p.id), { status: 'paid', paidAtMs: Date.now() });
    (p.commissionIds || []).forEach((id) => b.update(doc(db, 'commissions', id), { status: 'paid' }));
    try { await b.commit(); await reload(); } catch (e) { alert(e.message); }
  };
  if (!list.length) return <p className="card text-center text-dim">No payout requests.</p>;
  return <div className="space-y-2">{list.map((p) => (
    <div key={p.id} className="card flex flex-wrap items-center justify-between gap-3 !p-4 text-sm">
      <span><b>{p.workerName}</b> ({p.code})<br />{p.payout?.method} · {p.payout?.account} · {p.payout?.title}<br /><span className="text-faint">{formatDate(p.requestedAtMs)}</span></span>
      <span className="text-right"><b className="block text-lg text-gold">{formatPKR(p.amount)}</b>{p.status === 'paid' ? <span className="font-bold text-green-700">Paid</span> : <button className="btn-gold !px-4 !py-2" onClick={() => pay(p)}><Wallet size={15} /> Mark paid</button>}</span>
    </div>))}</div>;
}

function Money({ label, value, tone }) {
  return <div className="card !p-3"><p className="text-xs font-semibold text-dim">{label}</p><p className={`text-lg font-extrabold ${tone || 'text-gold'}`}>{formatPKR(value)}</p></div>;
}

function Payments({ comm, names }) {
  const now = Date.now();
  const st = (c) => (c.status === 'holding' && isAvailable(c, now) ? 'wallet' : c.status);
  const sum = (k) => comm.filter((c) => st(c) === k).reduce((a, c) => a + (c.amount || 0), 0);
  const csv = () => {
    const rows = [['Date', 'Order', 'Worker', 'Code', 'City', 'Repeat', 'Amount', 'Status', 'Wallet release date']].concat(comm.map((c) => [new Date(c.createdAtMs).toISOString().slice(0, 10), c.orderId, names[c.workerId] || '', c.workerCode, c.city || '', c.repeat ? 'yes' : '', c.amount, st(c), c.releaseAtMs ? new Date(c.releaseAtMs).toISOString().slice(0, 10) : '']));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'worker-commissions.csv'; a.click();
  };
  const label = { pending: 'Waiting delivery', holding: 'Releasing', wallet: 'In wallet', requested: 'Payout requested', paid: 'Paid', cancelled: 'Cancelled' };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Money label="Waiting delivery" value={sum('pending')} tone="text-yellow-700" />
        <Money label="Releasing (hold)" value={sum('holding')} tone="text-sky-700" />
        <Money label="In workers' wallets" value={sum('wallet') + sum('approved')} />
        <Money label="Payout requested" value={sum('requested')} tone="text-blue-700" />
        <Money label="Paid total" value={sum('paid')} tone="text-green-700" />
      </div>
      <button type="button" className="btn-ghost !py-2 text-sm" onClick={csv}><Download size={15} /> Download CSV</button>
      <div className="space-y-2">{comm.map((c) => (
        <div key={c.id} className="card flex flex-wrap items-center justify-between gap-2 !p-3 text-sm">
          <span><b>{c.orderId}</b>{c.repeat ? ' (repeat)' : ''}<br /><span className="text-dim">{names[c.workerId] || c.workerCode} · {c.city} · {formatDate(c.createdAtMs)}</span></span>
          <span className="text-right"><b className="block text-gold">{formatPKR(c.amount)}</b><span className="text-xs text-dim">{label[st(c)] || c.status}{isHolding(c, now) ? ` · wallet ${formatDate(c.releaseAtMs)}` : ''}</span></span>
        </div>))}
        {!comm.length && <p className="card text-center text-dim">No commissions yet.</p>}
      </div>
    </div>
  );
}

function Settings() {
  const [s, setS] = useState(DEFAULT_SETTINGS); const [msg, setMsg] = useState('');
  useEffect(() => { getDoc(doc(dbClient(), 'workerSettings', 'main')).then((x) => x.exists() && setS({ ...DEFAULT_SETTINGS, ...x.data() })).catch(() => {}); }, []);
  const save = async () => {
    try { await setDoc(doc(dbClient(), 'workerSettings', 'main'), { programOn: s.programOn !== false, repeatCredit: Boolean(s.repeatCredit), repeatDays: Math.max(1, Number(s.repeatDays) || 365), holdDays: Math.max(0, Number(s.holdDays) >= 0 ? Number(s.holdDays) : 8) }); setMsg('Saved. New orders use it within a minute.'); }
    catch (e) { setMsg(e.message); }
  };
  return (
    <div className="card space-y-4 text-sm">
      <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={s.programOn !== false} onChange={(e) => setS({ ...s, programOn: e.target.checked })} /> <span><b>Commissions ON</b><br /><span className="text-dim">Turn off to pause all new commissions (links still work, shop is not affected).</span></span></label>
      <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={Boolean(s.repeatCredit)} onChange={(e) => setS({ ...s, repeatCredit: e.target.checked })} /> <span><b>Repeat customers earn the worker commission</b><br /><span className="text-dim">ON: a new customer who first orders through a worker's link stays that worker's; later orders from the same phone earn them commission, even without the link. OFF: only orders placed through the link count. Existing customers who already ordered before are never taken over.</span></span></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="rd">Repeat window (days)</label><input id="rd" className="input" inputMode="numeric" value={s.repeatDays} onChange={(e) => setS({ ...s, repeatDays: e.target.value.replace(/\D/g, '') })} /></div>
        <div><label className="label" htmlFor="hd">Hold after delivery (days)</label><input id="hd" className="input" inputMode="numeric" value={s.holdDays} onChange={(e) => setS({ ...s, holdDays: e.target.value.replace(/\D/g, '') })} /></div>
      </div>
      <p className="text-xs text-dim">Hold days = the return window. After the hold the money moves into the worker's wallet by itself. Keep it a little longer than your real return time.</p>
      <button type="button" className="btn-gold w-full" onClick={save}>Save settings</button>
      {msg && <p role="status" className="font-semibold text-gold">{msg}</p>}
    </div>
  );
}

export default function AdminWorkers() {
  const [list, setList] = useState(null); const [pay, setPay] = useState([]); const [comm, setComm] = useState([]); const [tab, setTab] = useState('pending'); const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try {
      const [a, b, c] = await Promise.all([getDocs(query(collection(dbClient(), 'workers'), limit(300))), getDocs(query(collection(dbClient(), 'payouts'), orderBy('requestedAtMs', 'desc'), limit(100))), getDocs(query(collection(dbClient(), 'commissions'), orderBy('createdAtMs', 'desc'), limit(300)))]);
      setComm(c.docs.map((d) => ({ id: d.id, ...d.data() })));
      setList(a.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => (y.appliedAtMs || 0) - (x.appliedAtMs || 0)));
      setPay(b.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { setList([]); setErr(e.code === 'permission-denied' ? 'Publish the updated firestore.rules first (it adds the worker program).' : e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!list) return <p className="text-dim">Loading...</p>;
  const shown = list.filter((w) => w.status === tab);
  const open = pay.filter((p) => p.status === 'requested').length;
  return (
    <div className="space-y-4">
      {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      <div className="no-sb flex gap-2 overflow-x-auto">
        {[['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['suspended', 'Paused']].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${tab === k ? 'bg-gold text-white' : 'border border-line bg-surface text-dim'}`}>{l} ({list.filter((w) => w.status === k).length})</button>)}
        <button onClick={() => setTab('money')} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${tab === 'money' ? 'bg-gold text-white' : 'border border-line bg-surface text-dim'}`}>All payments</button>
        <button onClick={() => setTab('settings')} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${tab === 'settings' ? 'bg-gold text-white' : 'border border-line bg-surface text-dim'}`}>Settings</button>
        <button onClick={() => setTab('payouts')} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${tab === 'payouts' ? 'bg-gold text-white' : 'border border-line bg-surface text-dim'}`}>Payouts ({open})</button>
      </div>
      {tab === 'money' ? <Payments comm={comm} names={Object.fromEntries(list.map((w) => [w.id, w.name]))} /> : tab === 'settings' ? <Settings /> : tab === 'payouts' ? <Payouts list={pay} reload={load} /> : shown.length ? shown.map((w) => <Worker key={w.id} w={w} reload={load} />) : <p className="card text-center text-dim">Nothing here.</p>}
    </div>
  );
}
