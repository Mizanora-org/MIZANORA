'use client';
import { useCallback, useEffect, useState } from 'react';
import { authClient } from '@/lib/firebase-client';
import { Activity, Clock, Copy, Download, Eye, Link2, Loader2, Radio, RefreshCw, Users } from 'lucide-react';

// Admin > IPTV > Live now + connections + export.
// Yahan se pata chalta hai kaun online hai, kis app se, kaunsa channel chal raha hai,
// aur customer ko dene wale (portal / Xtream / M3U) links kya hain.
const ago = (t) => {
  const s = Math.max(0, Math.round((Date.now() - Number(t || 0)) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
};

export default function IptvOpsAdmin() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [cfg, setCfg] = useState(null);
  const [macs, setMacs] = useState(0);

  const token = useCallback(async () => {
    try { const u = authClient().currentUser; return u ? await u.getIdToken() : null; } catch { return null; }
  }, []);

  const load = useCallback(async () => {
    setBusy('load'); setErr('');
    const t = await token();
    if (!t) { setErr('Signed out.'); setBusy(''); return; }
    try {
      const [live, conf] = await Promise.all([
        fetch('/api/admin/iptv/live', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then((r) => r.json()).catch(() => null),
        fetch('/api/admin/iptv/export?what=config', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then((r) => r.json()).catch(() => null),
      ]);
      if (live?.ok) setData(live);
      else setErr(live?.error || 'Live data nahi mila.');
      if (conf?.ok) setCfg(conf);
    } catch (e) { setErr(e.message); }
    setBusy('');
  }, [token]);

  useEffect(() => { load(); const id = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 20_000); return () => clearInterval(id); }, [load]);

  async function download(what, filename) {
    const t = await token();
    if (!t) return;
    setBusy(what); setMsg('');
    try {
      const r = await fetch(`/api/admin/iptv/export?what=${what}`, { headers: { Authorization: `Bearer ${t}` } });
      if (!r.ok) throw new Error(`Server ${r.status}`);
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      if (what === 'macs') setMacs((n) => n);
      setMsg(`${filename} download ho gayi.`);
    } catch (e) { setErr(e.message); }
    setBusy('');
  }

  async function copy(v, label) {
    try { await navigator.clipboard.writeText(v); setMsg(`${label} copy ho gaya.`); } catch { setMsg('Copy nahi hua — khud select karein.'); }
  }

  const t = data?.totals || { online: 0, devices: 0, today: 0, logins: 0, plays: 0, apps: [] };
  const online = data?.online || [];
  const events = data?.events || [];

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold"><Radio size={16} className="text-gold" /> Live now &amp; connections</h2>
          <p className="text-xs text-dim">Har line ka heartbeat — kaun, kis app se, kaunsa channel. Har 20 second refresh.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={load} disabled={busy === 'load'}>
          {busy === 'load' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [Radio, t.online, 'Online abhi', 'text-gold'],
          [Eye, t.devices, 'Devices live', 'text-cream'],
          [Activity, t.plays, 'Streams (24h)', 'text-cream'],
          [Users, t.logins, 'Logins (24h)', 'text-cream'],
        ].map(([Icon, v, l, c]) => (
          <div key={l} className="rounded-xl border border-line bg-raised p-3">
            <Icon size={14} className="text-gold" />
            <p className={`mt-1 font-display text-lg font-black ${c}`}>{v ?? 0}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-faint">{l}</p>
          </div>
        ))}
      </div>

      {msg && <p className="rounded-xl border border-gold/30 bg-gold/[0.06] px-3 py-2 text-xs font-semibold text-gold">{msg}</p>}
      {err && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{err}</p>}

      {!!online.length && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-faint">
              <tr><th className="py-1">Line</th><th>Client</th><th>Channel</th><th>App</th><th>IP</th><th>Devices</th><th>Last</th></tr>
            </thead>
            <tbody>
              {online.slice(0, 25).map((s) => (
                <tr key={s.username} className="border-t border-line/60">
                  <td className="py-1.5 font-mono text-xs font-semibold text-cream">{s.username}</td>
                  <td className="text-xs text-dim">{s.clientName || '—'}</td>
                  <td className="max-w-[10rem] truncate text-xs text-dim">{s.channel || s.kind || '—'}</td>
                  <td className="text-xs text-dim">{s.app || '—'}</td>
                  <td className="font-mono text-[11px] text-faint">{s.ip || '—'}</td>
                  <td className="text-xs tabular-nums text-dim">{s.devices || 1}</td>
                  <td className="text-xs tabular-nums text-faint">{ago(s.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && !online.length && <p className="text-xs text-faint">Koi device abhi online nahi — jaise hi customer app kholay ga, yahan nazar aayega.</p>}

      {!!(t.apps || []).length && (
        <div className="flex flex-wrap gap-1.5">
          {t.apps.map((a) => (
            <span key={a.name} className="rounded-full border border-line bg-raised px-2.5 py-1 text-[11px] font-semibold text-dim">{a.name} · {a.n}</span>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-line bg-raised p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-faint"><Link2 size={12} /> Customer ko yeh dein</p>
        <div className="mt-2 space-y-1.5 text-[11px]">
          {[
            ['Xtream / M3U (phone, TV, TiviMate)', cfg?.m3u || 'get.php?username=USER&password=PASS'],
            ['Stalker portal (MAG box)', cfg?.portal || '/c/'],
            ['EPG (XMLTV)', cfg?.epg || 'xmltv.php'],
          ].map(([label, val]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-44 shrink-0 text-dim">{label}</span>
              <code className="flex-1 truncate rounded bg-surface px-2 py-1 font-mono text-[10.5px] text-cream">{val}</code>
              <button type="button" className="text-faint hover:text-gold" onClick={() => copy(val, label)} aria-label="Copy"><Copy size={12} /></button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => download('m3u', 'mizanora-catalogue.m3u')} disabled={busy === 'm3u'}>
            {busy === 'm3u' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Catalogue M3U (backup)
          </button>
          <button type="button" className="btn-ghost" onClick={() => download('macs', 'mizanora-macs.csv')} disabled={busy === 'macs'}>
            {busy === 'macs' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} MAC list CSV
          </button>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-faint">
          <Clock size={12} className="mt-0.5 shrink-0" />
          MAC list sirf server par hai — customer ko uska apna MAC aur portal URL dein. Backup M3U mein asli links hote hain, isay public na karein.
        </p>
      </div>

      {!!events.length && (
        <details className="rounded-xl border border-line bg-surface p-3">
          <summary className="cursor-pointer text-xs font-bold text-cream">Event log (aakhri {Math.min(events.length, 120)})</summary>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {events.slice(0, 60).map((e) => (
              <li key={e.id} className="flex items-center gap-2 border-b border-line/40 py-1 text-[11px]">
                <span className="w-24 shrink-0 font-mono text-faint">{new Date(Number(e.at) || 0).toLocaleTimeString('en-GB')}</span>
                <span className="w-24 shrink-0 font-semibold text-gold">{e.type}</span>
                <span className="w-28 shrink-0 truncate font-mono text-cream">{e.username || '—'}</span>
                <span className="flex-1 truncate text-dim">{e.channel || e.app || e.clientName || ''}</span>
                <span className="shrink-0 font-mono text-faint">{e.ip || ''}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
