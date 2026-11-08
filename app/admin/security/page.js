'use client';
import { useCallback, useEffect, useState } from 'react';
import { Ban, LockKeyhole, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { authClient } from '@/lib/firebase-client';

const when = (at) => at ? new Date(at).toLocaleString() : '—';
const typeName = {
  'admin-auth-missing': 'Admin login attempt', 'admin-token-invalid': 'Invalid admin token',
  'admin-access-denied': 'Non-admin access', 'probe-sensitive-path': 'Sensitive path probe',
  'image-relay-invalid': 'Image relay probe', 'tv-relay-invalid': 'TV relay probe',
  'rate-limit': 'Too many requests',
};

export default function SecurityPage() {
  const [report, setReport] = useState(null);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState(24);
  const call = useCallback(async (body) => {
    const user = authClient().currentUser;
    if (!user) throw new Error('Dobara sign in karein.');
    const r = await fetch('/api/admin/security', { method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(body) });
    const result = await r.json().catch(() => ({}));
    if (!r.ok || !result.ok) throw new Error(result.error || `HTTP ${r.status}`);
    return result;
  }, []);
  const load = useCallback(async () => {
    setBusy('load');
    try { setReport(await call({ action: 'list', days })); setMsg(''); }
    catch (e) { setMsg(e.message); }
    setBusy('');
  }, [call, days]);
  useEffect(() => { load(); }, [load]);

  async function block(address = ip) {
    if (!address) return;
    if (!window.confirm(`IP ${address} ko ${hours} ghanton ke liye block karein? Ghalat IP block hone par genuine visitors ruk sakte hain.`)) return;
    setBusy('block');
    try { await call({ action: 'block', ip: address, hours, reason }); setMsg(`${address} blocked.`); setIp(''); await load(); }
    catch (e) { setMsg(e.message); }
    setBusy('');
  }
  async function unblock(address) {
    if (!window.confirm(`IP ${address} unblock karein?`)) return;
    setBusy('unblock');
    try { await call({ action: 'unblock', ip: address }); setMsg(`${address} unblocked.`); await load(); }
    catch (e) { setMsg(e.message); }
    setBusy('');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-3xl font-bold"><ShieldAlert className="text-red-600" /> Security &amp; IP alerts</h1>
          <p className="mt-1 text-sm text-dim">Suspicious admin requests, blocked URLs aur media-relay abuse. Full IPs sirf private Realtime Database mein rehte hain, public repo mein nahi.</p></div>
        <button type="button" className="btn-ghost" disabled={Boolean(busy)} onClick={load}><RefreshCw size={16} /> Refresh</button>
      </div>
      <p className="rounded-xl border border-amber-500 bg-amber-50 p-3 text-xs text-amber-950">IP blocks dynamic pages aur APIs par lagte hain. Already-cached static assets aur hosting-provider network layer ke liye alag WAF rules zaroori hain. Sirf trusted Vercel proxy (ya TRUST_PROXY_HEADERS=1 wala secured reverse proxy) par IP header se block apply hota hai; missing RTDB par blocking unavailable hoti hai.</p>
      {msg && <p role="alert" className="rounded-xl bg-raised p-3 text-sm">{msg}</p>}
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Ban size={18} /> IP block karein</h2>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input className="input" aria-label="Full IP address" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="e.g. 203.0.113.40" />
          <input className="input" aria-label="Block reason" maxLength={140} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Wajah (optional)" />
          <select className="input" aria-label="Block duration" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            <option value={1}>1 hour</option><option value={24}>24 hours</option><option value={168}>7 days</option><option value={720}>30 days</option>
          </select>
        </div>
        <button type="button" className="btn-gold" disabled={Boolean(busy) || !ip.trim()} onClick={() => block()}>Block IP</button>
      </section>
      {report && <>
        <div className="grid gap-3 sm:grid-cols-3">
          <p className="card text-sm"><ShieldAlert size={17} className="mb-1 text-red-600" /> <b>{report.alerts}</b> high alerts ({report.days} days)</p>
          <p className="card text-sm"><LockKeyhole size={17} className="mb-1" /> <b>{report.blocked.length}</b> blocked IPs</p>
          <p className="card text-sm"><ShieldCheck size={17} className="mb-1" /> <b>{report.events.length}</b> recent events</p>
        </div>
        <section className="card space-y-3">
          <h2 className="text-lg font-bold">Active blocks</h2>
          {!report.blocked.length ? <p className="text-sm text-dim">Abhi kisi IP par block nahi.</p> : <ul className="space-y-2">
            {report.blocked.map((b) => <li key={b.ip} className="flex flex-wrap items-center gap-2 rounded-lg bg-raised p-3 text-sm">
              <b className="font-mono">{b.ip}</b><span className="text-dim">until {when(b.until)} · {b.reason || 'manual block'}</span>
              <button type="button" disabled={Boolean(busy)} className="btn-ghost ml-auto !px-3 !py-1" onClick={() => unblock(b.ip)}>Unblock</button>
            </li>)}</ul>}
        </section>
        <section className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Recent suspicious actions</h2>
            <select aria-label="Log range" className="input max-w-36" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={1}>Today</option><option value={7}>7 days</option><option value={14}>14 days</option></select></div>
          {!report.events.length ? <p className="text-sm text-dim">Abhi koi suspicious activity log nahi.</p> : <ul className="space-y-2">
            {report.events.map((e) => <li key={`${e.at}-${e.id}`} className="rounded-lg border border-line bg-raised p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2"><b className={e.severity === 'high' ? 'text-red-600' : 'text-cream'}>{typeName[e.kind] || e.kind}</b>
                <span className="text-dim">{when(e.at)} · {e.country || '—'} · {e.route || '—'}</span>
                {e.ip && e.ip !== 'unknown' && <button type="button" className="btn-ghost ml-auto !px-3 !py-1 text-xs" disabled={Boolean(busy)} onClick={() => block(e.ip)}>Block {e.ip}</button>}</div>
              <p className="mt-1 break-all text-xs text-dim">IP: {e.ip || 'unknown'} · {e.reason || '—'} · {e.ua || '—'}</p>
            </li>)}</ul>}
        </section>
      </>}
    </div>
  );
}
