'use client';
import { useCallback, useEffect, useState } from 'react';
import { authClient } from '@/lib/firebase-client';
import { AlertTriangle, BadgeCheck, Ban, CalendarClock, Loader2, RefreshCw, Smartphone, Wallet } from 'lucide-react';

// Admin > IPTV > Billing — cycle 1–10, due/overdue list, reminder text, manual renew/suspend.
const rs = (n) => `Rs ${Number(n || 0).toLocaleString('en-PK')}`;
const STATE_STYLE = {
  due: 'border-amber-300 bg-amber-50 text-amber-700',
  overdue: 'border-orange-300 bg-orange-50 text-orange-700',
  suspend: 'border-red-300 bg-red-50 text-red-700',
};

export default function IptvBillingAdmin() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const call = useCallback(async (body, method = 'POST') => {
    const u = authClient().currentUser;
    if (!u) return { ok: false, error: 'Signed out.' };
    const token = await u.getIdToken();
    try {
      const r = await fetch('/api/admin/iptv/billing', {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: method === 'GET' ? undefined : JSON.stringify(body),
      });
      return await r.json().catch(() => ({ ok: false, error: `Server ${r.status}` }));
    } catch (e) { return { ok: false, error: e.message }; }
  }, []);

  const load = useCallback(async () => {
    setBusy('load'); setErr('');
    const j = await call(null, 'GET');
    if (j.ok) setData(j); else setErr(j.error || 'Load nahi hua.');
    setBusy('');
  }, [call]);

  useEffect(() => { load(); }, [load]);

  const act = async (body, label) => {
    setBusy(label); setMsg(''); setErr('');
    const j = await call(body);
    setMsg(j.ok ? `${label} — ho gaya` : (j.error || 'Nahi hua'));
    setBusy('');
    if (j.ok) setTimeout(load, 400);
  };

  const c = data?.counts || {};
  const cards = [
    ['ok', c.ok || 0, 'Theek', 'text-emerald-600'],
    ['due', c.due || 0, '3 din andar', 'text-amber-600'],
    ['overdue', c.overdue || 0, 'Expire ho chuki', 'text-orange-600'],
    ['suspend', c.suspend || 0, 'Band honi chahiye', 'text-red-600'],
  ];

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold"><Wallet size={16} className="text-gold" /> Billing — cycle {data?.cycle?.from ?? 1}–{data?.cycle?.to ?? 10}</h2>
          <p className="text-xs text-dim">
            Due list, reminder text aur aik click renew. Auto-suspend roz <code>/api/cron/iptv</code> chalata hai (expiry ke {data?.graceDays ?? 3} din baad).
          </p>
        </div>
        <button type="button" className="btn-ghost !px-2 !py-1 text-[11px]" onClick={load} disabled={busy === 'load'}>
          {busy === 'load' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Refresh
        </button>
      </div>

      {msg && <p className="rounded-xl border border-gold/30 bg-gold/[0.06] px-3 py-2 text-xs font-semibold text-gold">{msg}</p>}
      {err && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{err}</p>}

      {data?.cron === false && (
        <p className="flex items-start gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span><code>CRON_SECRET</code> set nahi hai — auto-suspend nahi chalega. Vercel env mein 32+ chars ka secret daalein (vercel.json ka cron khud isay use karta hai).</span>
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([id, v, label, color]) => (
          <div key={id} className="rounded-xl border border-line bg-raised p-2.5">
            <p className={`font-display text-2xl font-black ${color}`}>{Number(v).toLocaleString('en-PK')}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-faint">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-dim">
        <span className="rounded-full border border-line bg-surface px-2 py-1">Payment ki aakhri tareekh: <b className="text-cream">{data?.dueAt ? new Date(data.dueAt).toLocaleDateString('en-GB') : '—'}</b></span>
        <span className="rounded-full border border-line bg-surface px-2 py-1">Total lines: <b className="text-cream">{c.total ?? 0}</b></span>
        <span className="rounded-full border border-red-300 bg-red-50 px-2 py-1 text-red-700">At risk: <b>{rs(c.amountAtRisk)}</b></span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-faint">
            <tr><th className="py-1">Line</th><th>Client</th><th>Halat</th><th>Expiry</th><th>Amount</th><th className="text-right">Action</th></tr>
          </thead>
          <tbody>
            {(data?.lines || []).map((l) => (
              <tr key={l.id} className="border-t border-line/60">
                <td className="py-1.5 font-mono text-xs text-cream">{l.username}</td>
                <td className="text-xs text-dim">{l.clientName || '—'}<span className="block text-[10px] text-faint">{l.phone || ''}</span></td>
                <td>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATE_STYLE[l.state] || 'border-line bg-surface text-dim'}`}>
                    {l.state}{l.daysLate ? ` · ${l.daysLate}d late` : l.daysLeft ? ` · ${l.daysLeft}d` : ''}
                  </span>
                </td>
                <td className="text-xs tabular-nums text-dim">{l.expiresAt ? new Date(l.expiresAt).toLocaleDateString('en-GB') : '—'}</td>
                <td className="text-xs tabular-nums text-dim">{rs(l.amount)}</td>
                <td className="whitespace-nowrap text-right">
                  <button type="button" className="btn-ghost !px-2 !py-1 text-[10.5px]" onClick={() => act({ action: 'markPaid', id: l.id, months: 1 }, 'Renew +1')} title="Payment mil gayi — 1 mahina barhao">
                    {busy === 'Renew +1' ? <Loader2 size={11} className="animate-spin" /> : <BadgeCheck size={11} />} +1 month
                  </button>
                  <a className="btn-ghost ml-1 !px-2 !py-1 text-[10.5px]" target="_blank" rel="noreferrer"
                    href={`https://wa.me/${String(l.phone || '').replace(/[^\d]/g, '').replace(/^0/, '92')}?text=${encodeURIComponent(l.text || '')}`}
                    title="WhatsApp reminder"><Smartphone size={11} /> remind</a>
                  <button type="button" className="ml-1 text-faint hover:text-red-600" onClick={() => act({ action: 'suspend', id: l.id }, 'Suspend')} title="Suspend"><Ban size={11} /></button>
                </td>
              </tr>
            ))}
            {!(data?.lines || []).length && <tr><td colSpan={6} className="py-3 text-xs text-faint">Koi due line nahi — sab clear hai. 🎉</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="flex items-center gap-1.5 text-[10.5px] text-faint"><CalendarClock size={11} /> Reminder text client ke naam, amount aur JazzCash number ke sath khud banta hai.</p>
    </section>
  );
}
