'use client';
import { useCallback, useEffect, useState } from 'react';
import { authClient } from '@/lib/firebase-client';
import {
  Tv, Users, Wallet, CheckCircle2, RefreshCw, Ban, Loader2, Info, Smartphone, MonitorSmartphone,
} from 'lucide-react';
import { IPTV, lineState, planById, pkr } from '@/lib/iptv';
import IptvCatalogueAdmin from './IptvCatalogueAdmin';
import { formatDate } from '@/lib/format';

export default function AdminIptv() {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const token = useCallback(async () => {
    try { const u = authClient().currentUser; return u ? await u.getIdToken() : null; } catch { return null; }
  }, []);

  const call = useCallback(async (body) => {
    const t = await token();
    if (!t) return { ok: false, error: 'Signed out. Reload karein.' };
    try {
      const r = await fetch('/api/admin/iptv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(body),
      });
      return await r.json().catch(() => ({ ok: false, error: `Server ${r.status}` }));
    } catch (e) { return { ok: false, error: e.message }; }
  }, [token]);

  const load = useCallback(async () => {
    setBusy('load'); setErr('');
    const j = await call({ action: 'list' });
    if (j.ok) setData(j); else setErr(j.error || 'Load nahi hua.');
    setBusy('');
  }, [call]);

  useEffect(() => { load(); }, [load]);

  const act = async (action, id, label, extra = {}) => {
    setBusy(id); setMsg('');
    const j = await call({ action, id, ...extra });
    setMsg(j.ok ? `${label} — ho gaya` : (j.error || 'Nahi hua'));
    setBusy('');
    if (j.ok) setTimeout(load, 600);
  };

  if (busy === 'load' && !data) {
    return <div className="card flex items-center gap-2 text-sm text-dim"><Loader2 size={16} className="animate-spin" /> Panel load ho raha hai…</div>;
  }

  if (err && !data) {
    return (
      <div className="card border-red-200 bg-red-50/50">
        <p className="text-sm font-semibold text-red-700">IPTV panel load nahi hua</p>
        <p className="mt-1 text-xs text-red-600">{err}</p>
        <button className="btn-ghost mt-3" onClick={load}><RefreshCw size={14} /> Dobara koshish</button>
      </div>
    );
  }

  const k = data?.kpis || {};
  const trials = data?.trials || [];
  const lines = data?.lines || [];
  const collection = data?.collection || [];
  const apps = data?.apps || [];
  const resellers = data?.resellers || [];
  const users = data?.users || [];

  return (
    <div className="space-y-4">
      {data?.demo && (
        <p className="flex items-start gap-2 rounded-xl border border-line bg-raised px-3 py-2 text-[11px] text-dim">
          <Info size={13} className="mt-0.5 shrink-0 text-gold" />
          Demo data — Firestore connect hone par ye poori list live ho jayegi (siteMeta/iptv + iptvLines / iptvTrials).
        </p>
      )}
      {msg && <p className="rounded-xl border border-gold/30 bg-gold/[0.06] px-3 py-2 text-xs font-semibold text-gold">{msg}</p>}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [Tv, k.lines ?? 0, 'Active lines', 'text-gold'],
          [Users, k.trials ?? 0, 'Trial requests', 'text-cream'],
          [Wallet, pkr(k.mrr ?? 0), 'Monthly wholesale', 'text-gold'],
          [CheckCircle2, `${k.collected ?? 0}%`, `Collected 1–${IPTV.cycle.to}`, 'text-cream'],
        ].map(([Icon, v, l, c]) => (
          <div key={l} className="card">
            <Icon size={16} className="text-gold" />
            <p className={`mt-2 font-display text-xl font-black ${c}`}>{v}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-faint">{l}</p>
          </div>
        ))}
      </div>

      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-base font-bold">Trial requests</h2>
          <span className="text-[11px] text-faint">{trials.length} naye</span>
        </div>
        {trials.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] text-left text-sm">
              <thead><tr className="border-b border-line text-[10px] uppercase tracking-wider text-faint"><th className="py-2">Naam</th><th>Phone</th><th>Shehr</th><th>Device</th><th>Kab</th><th /></tr></thead>
              <tbody>
                {trials.map((t) => (
                  <tr key={t.id} className="border-b border-line/60">
                    <td className="py-2 font-semibold">{t.name}</td>
                    <td className="tabular-nums text-dim">{t.phone}</td>
                    <td className="text-dim">{t.city}</td>
                    <td className="text-dim">{t.device === 'mag' ? <MonitorSmartphone size={14} className="inline" /> : <Smartphone size={14} className="inline" />} {t.device}</td>
                    <td className="text-[11px] text-faint">{t.at ? formatDate(t.at) : '—'}</td>
                    <td className="text-right">
                      <button className="btn-gold btn-sm" disabled={busy === t.id} onClick={() => act('approve', t.id, 'Trial line ban gayi')}>
                        {busy === t.id ? <Loader2 size={12} className="animate-spin" /> : 'Approve'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-xs text-dim">Abhi koi trial request nahi.</p>}
      </section>

      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-base font-bold">Lines</h2>
          <span className="text-[11px] text-faint">cap {pkr(IPTV.cap)} / mahina</span>
        </div>
        {lines.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead><tr className="border-b border-line text-[10px] uppercase tracking-wider text-faint"><th className="py-2">Line</th><th>Plan</th><th>Reseller</th><th>Expiry</th><th>State</th><th /></tr></thead>
              <tbody>
                {lines.map((l) => {
                  const st = lineState(l.expiresAt);
                  return (
                    <tr key={l.id} className="border-b border-line/60">
                      <td className="py-2 font-semibold">{l.username || l.mac || l.id}</td>
                      <td className="text-dim">{planById(l.plan)?.name || l.plan}</td>
                      <td className="text-dim">{l.resellerName || '—'}</td>
                      <td className="text-[11px] text-dim">{l.expiresAt ? formatDate(l.expiresAt) : '—'}</td>
                      <td>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${st.state === 'active' ? 'border-gold/30 bg-gold/10 text-gold' : st.state === 'expiring' ? 'border-saffron/40 bg-saffron/10 text-[#8a5a00]' : 'border-red-200 bg-red-50 text-red-700'}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="inline-flex gap-1">
                          <button className="btn-ghost btn-sm" disabled={busy === l.id} onClick={() => act('extend', l.id, '30 din barh gaye')}>
                            {busy === l.id ? <Loader2 size={12} className="animate-spin" /> : '+30d'}
                          </button>
                          <button className="btn-ghost btn-sm" disabled={busy === l.id} onClick={() => act('suspend', l.id, 'Line suspend')}>
                            <Ban size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="text-xs text-dim">Abhi koi line nahi.</p>}
      </section>

      <IptvCatalogueAdmin />

      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-base font-bold">IPTV users</h2>
          <span className="text-[11px] text-faint">{users.length} accounts</span>
        </div>
        {users.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead><tr className="border-b border-line text-[10px] uppercase tracking-wider text-faint"><th className="py-2">Account</th><th>Lines</th><th>Active</th><th>Trial</th><th /></tr></thead>
              <tbody>
                {users.slice(0, 25).map((x) => (
                  <tr key={x.uid} className="border-b border-line/60">
                    <td className="py-2">
                      <b className="block truncate">{x.email || x.name || x.uid.slice(0, 10)}</b>
                      <span className="text-[11px] text-faint">{x.uid.slice(0, 16)}…</span>
                    </td>
                    <td className="text-dim">{x.lines}</td>
                    <td className="text-dim">{x.active}</td>
                    <td>{x.trial ? <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-bold text-gold">free key</span> : <span className="text-[11px] text-faint">—</span>}</td>
                    <td className="text-right text-[11px] text-faint">{x.lastAt ? formatDate(x.lastAt) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-xs text-dim">Abhi koi self-service account nahi (Google se sign in kar ke /iptv/start par key lein).</p>}
      </section>

      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-base font-bold">Reseller applications</h2>
          <span className="text-[11px] text-faint">{apps.length} nayi</span>
        </div>
        {apps.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead><tr className="border-b border-line text-[10px] uppercase tracking-wider text-faint"><th className="py-2">Naam</th><th>Phone</th><th>Shehr</th><th>Experience</th><th>Kab</th><th /></tr></thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="border-b border-line/60">
                    <td className="py-2 font-semibold">{a.name}</td>
                    <td className="tabular-nums text-dim">{a.phone}</td>
                    <td className="text-dim">{a.city}</td>
                    <td className="text-dim">{a.experience || '—'}</td>
                    <td className="text-[11px] text-faint">{a.at ? formatDate(a.at) : '—'}</td>
                    <td className="text-right">
                      <div className="inline-flex gap-1">
                        <button className="btn-gold btn-sm" disabled={busy === a.id} onClick={() => act('approveReseller', a.id, 'Reseller approve (10 lines credit)')}>
                          {busy === a.id ? <Loader2 size={12} className="animate-spin" /> : 'Approve'}
                        </button>
                        <button className="btn-ghost btn-sm" disabled={busy === a.id} onClick={() => act('rejectReseller', a.id, 'Application reject')} title="Reject">
                          <Ban size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-xs text-dim">Koi nayi application nahi.</p>}
        <p className="mt-2 text-[11px] text-faint">Approve karne par reseller ka uid bound hota hai — woh sidha <code>/reseller</code> panel khol sakta hai. Credit badalna ho to neeche se barhayein.</p>
      </section>

      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-base font-bold">Resellers</h2>
          <span className="text-[11px] text-faint">{resellers.length} approved</span>
        </div>
        {resellers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead><tr className="border-b border-line text-[10px] uppercase tracking-wider text-faint"><th className="py-2">Reseller</th><th>Credit</th><th>Price</th><th>Paid is cycle</th><th /></tr></thead>
              <tbody>
                {resellers.map((r) => (
                  <tr key={r.id} className="border-b border-line/60">
                    <td className="py-2">
                      <b className="block">{r.name}</b>
                      <span className="text-[11px] text-faint">{r.phone || ''}</span>
                    </td>
                    <td className="text-dim">{r.used}/{r.credit}</td>
                    <td className="tabular-nums text-dim">{pkr(r.price)}</td>
                    <td className="tabular-nums text-dim">{pkr(r.paidThisCycle)}</td>
                    <td className="text-right">
                      <div className="inline-flex gap-1">
                        <button className="btn-ghost btn-sm" disabled={busy === r.id} onClick={() => act('addCredit', r.id, '+10 credit', { n: 10 })}>
                          {busy === r.id ? <Loader2 size={12} className="animate-spin" /> : '+10'}
                        </button>
                        <button className="btn-ghost btn-sm" disabled={busy === r.id} onClick={() => act('markPaid', r.id, 'Payment record ho gayi', { amount: IPTV.wholesale * (r.used || 0) })}>
                          Paid
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-xs text-dim">Abhi koi reseller approve nahi hua.</p>}
      </section>

      <section className="card">
        <h2 className="mb-2 font-display text-base font-bold">Collection {IPTV.cycle.from}–{IPTV.cycle.to}</h2>
        <div className="space-y-1.5">
          {collection.map((c) => {
            const pct = c.due ? Math.round((c.paid / c.due) * 100) : 0;
            return (
              <div key={c.reseller} className="flex items-center gap-2 rounded-xl border border-line bg-raised px-3 py-2 text-xs">
                <b className="min-w-0 flex-1 truncate">{c.reseller}</b>
                <span className="text-faint">{c.connections} lines</span>
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line">
                  <div className={`h-full rounded-full ${pct === 100 ? 'bg-gold' : pct > 40 ? 'bg-saffron' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-24 text-right tabular-nums text-dim">{pkr(c.paid)}</span>
              </div>
            );
          })}
          {!collection.length && <p className="text-xs text-dim">Is cycle ka data nahi.</p>}
        </div>
        <p className="mt-2 text-[11px] text-faint">
          Rule: {IPTV.cycle.from}–{IPTV.cycle.to} wasooli, {IPTV.suspendDay} tareekh par auto-suspend.
          Collection JazzCash 0306-2015326 par.
        </p>
      </section>
    </div>
  );
}
