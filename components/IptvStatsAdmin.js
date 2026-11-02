'use client';
import { useCallback, useEffect, useState } from 'react';
import { authClient } from '@/lib/firebase-client';
import { Activity, BarChart3, Loader2, Radio, RefreshCw, Tv, Users } from 'lucide-react';

// Admin > IPTV > Analytics — din ke hisab se plays, top channels, top apps, reseller-wise lines.
export default function IptvStatsAdmin() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async (d = days) => {
    setBusy('load'); setErr('');
    const u = authClient().currentUser;
    if (!u) { setErr('Signed out.'); setBusy(''); return; }
    const token = await u.getIdToken();
    try {
      const r = await fetch(`/api/admin/iptv/stats?days=${d}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const j = await r.json().catch(() => ({ ok: false }));
      if (j.ok) setData(j); else setErr(j.error || 'Stats nahi mile.');
    } catch (e) { setErr(e.message); }
    setBusy('');
  }, [days]);

  useEffect(() => { load(days); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [days]);

  const k = data?.kpi || {};
  const daily = data?.daily || [];
  const max = Math.max(1, ...daily.map((d) => d.plays + d.logins));

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold"><BarChart3 size={16} className="text-gold" /> Analytics</h2>
          <p className="text-xs text-dim">Plays, logins, channels, apps aur reseller — sab kuch event log se.</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30].map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)}
              className={`rounded-xl border px-2.5 py-1 text-[11px] font-bold ${days === d ? 'border-gold/40 bg-gold/[0.08] text-gold' : 'border-line bg-surface text-dim'}`}>{d}d</button>
          ))}
          <button type="button" className="btn-ghost" onClick={() => load(days)} disabled={busy === 'load'}>
            {busy === 'load' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      </div>

      {err && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{err}</p>}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [Users, k.lines ?? 0, 'Lines', 'text-cream'],
          [Radio, k.online ?? 0, 'Online abhi', 'text-gold'],
          [Activity, k.plays24h ?? 0, 'Streams 24h', 'text-cream'],
          [Tv, k.devices ?? 0, 'Devices live', 'text-cream'],
        ].map(([Icon, v, l, c]) => (
          <div key={l} className="rounded-xl border border-line bg-raised p-3">
            <Icon size={14} className="text-gold" />
            <p className={`mt-1 font-display text-lg font-black ${c}`}>{v}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-faint">{l}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface p-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Plays aur logins — {days} din</p>
        <div className="mt-2 flex h-24 items-end gap-1">
          {daily.map((d) => (
            <div key={d.day} className="group flex flex-1 flex-col justify-end" title={`${d.day}: ${d.plays} plays, ${d.logins} logins`}>
              <div className="w-full rounded-t bg-gold/70" style={{ height: `${Math.round((d.plays / max) * 72)}px` }} />
              <div className="w-full rounded-b bg-cream/20" style={{ height: `${Math.round((d.logins / max) * 24)}px` }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-faint">
          <span>{daily[0]?.day || ''}</span>
          <span className="flex items-center gap-2"><i className="inline-block h-2 w-2 rounded-sm bg-gold/70" /> plays <i className="inline-block h-2 w-2 rounded-sm bg-cream/20" /> logins</span>
          <span>{daily[daily.length - 1]?.day || ''}</span>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Top channels</p>
          <ul className="mt-1 space-y-1">
            {(data?.topChannels || []).map((c) => (
              <li key={c.name} className="flex items_center justify-between gap-2 text-xs">
                <span className="truncate text-cream">{c.name}</span>
                <span className="tabular-nums text-faint">{c.plays}</span>
              </li>
            ))}
            {!(data?.topChannels || []).length && <li className="text-xs text-faint">Abhi data nahi.</li>}
          </ul>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Apps</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(data?.topApps || []).map((a) => (
              <span key={a.name} className="rounded-full border border-line bg-raised px-2 py-0.5 text-[11px] text-dim">{a.name} · {a.n}</span>
            ))}
            {!(data?.topApps || []).length && <span className="text-xs text-faint">Abhi data nahi.</span>}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-faint">
            <tr><th className="py-1">Reseller</th><th>Lines</th><th>Active</th><th>Online</th><th>Plays</th></tr>
          </thead>
          <tbody>
            {(data?.resellers || []).slice(0, 10).map((r) => (
              <tr key={r.reseller} className="border-t border-line/60">
                <td className="max-w-[12rem] truncate py-1.5 text-xs font-semibold text-cream">{r.reseller}</td>
                <td className="text-xs tabular-nums text-dim">{r.lines}</td>
                <td className="text-xs tabular-nums text-dim">{r.active}</td>
                <td className="text-xs tabular-nums text-gold">{r.online}</td>
                <td className="text-xs tabular-nums text-dim">{r.plays}</td>
              </tr>
            ))}
            {!(data?.resellers || []).length && <tr><td colSpan={5} className="py-3 text-xs text-faint">Abhi koi reseller data nahi.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
