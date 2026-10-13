'use client';
import { useCallback, useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore';
import { CheckCircle2, Eye, Pause, Wallet, XCircle } from 'lucide-react';
import { dbClient } from '@/lib/firebase-client';
import { formatDate, formatPKR } from '@/lib/format';
import { TIERS, deliveryRate, earnedTier, tierByKey } from '@/lib/workers';

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

export default function AdminWorkers() {
  const [list, setList] = useState(null); const [pay, setPay] = useState([]); const [tab, setTab] = useState('pending'); const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([getDocs(query(collection(dbClient(), 'workers'), limit(300))), getDocs(query(collection(dbClient(), 'payouts'), orderBy('requestedAtMs', 'desc'), limit(100)))]);
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
        <button onClick={() => setTab('payouts')} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${tab === 'payouts' ? 'bg-gold text-white' : 'border border-line bg-surface text-dim'}`}>Payouts ({open})</button>
      </div>
      {tab === 'payouts' ? <Payouts list={pay} reload={load} /> : shown.length ? shown.map((w) => <Worker key={w.id} w={w} reload={load} />) : <p className="card text-center text-dim">Nothing here.</p>}
    </div>
  );
}
