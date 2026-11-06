'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity, BarChart3, Globe2, Loader2, MapPin, Monitor, RefreshCw, ShieldAlert, Smartphone, Target, Users,
} from 'lucide-react';
import { authClient } from '@/lib/firebase-client';

// Admin > Traffic (v56).
//
// The old dashboard answered "who is on the site now". This page answers the bigger question:
// *how many people came today, from where, on what, and how far are we from 100,000 a day?*
// Numbers come from /api/admin/traffic, which reads the `an/` namespace written by
// /api/analytics/collect (server-side, Realtime Database — zero Firestore reads).
const FLAGS = { PK: '🇵🇰', IN: '🇮🇳', US: '🇺🇸', GB: '🇬🇧', AE: '🇦🇪', SA: '🇸🇦', CA: '🇨🇦', AU: '🇦🇺', DE: '🇩🇪', BD: '🇧🇩', AF: '🇦🇫', TR: '🇹🇷', MY: '🇲🇾', QA: '🇶🇦', KW: '🇰🇼', OM: '🇴🇲', SG: '🇸🇬', FR: '🇫🇷', NL: '🇳🇱', ID: '🇮🇩', PH: '🇵🇭', NG: '🇳🇬', ZA: '🇿🇦', XX: '🌍' };
const nf = new Intl.NumberFormat('en-PK');
const pretty = (s) => {
  const t = String(s || '');
  if (!t) return '—';
  if (/^\d+_\d+_\d+_\d+$/.test(t)) return t.replace(/_/g, '.');
  if (t === 'home') return '/';
  if (!t.includes('/') && t.includes('_')) return `/${t.replace(/_/g, '/')}`;
  return t;
};
const ago = (t) => {
  const s = Math.max(0, Math.round((Date.now() - (Number(t) || 0)) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
};

function Stat({ label, value, sub, icon: Icon, tone = 'text-cream' }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-1.5 text-[0.68rem] font-extrabold uppercase tracking-wider text-faint">
        {Icon && <Icon size={13} />} {label}
      </div>
      <p className={`mt-1 font-display text-2xl font-extrabold tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs font-semibold text-dim">{sub}</p>}
    </div>
  );
}

function Table({ title, rows, icon: Icon, labelKey = 'key', valueKey = 'value', format }) {
  const max = Math.max(1, ...rows.map((r) => Number(r[valueKey]) || 0));
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-extrabold text-cream">
        {Icon && <Icon size={14} className="text-gold" />} {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-xs text-dim">Abhi koi data nahi — pehla visit aate hi bhar jayega.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r[labelKey]} className="flex items-center gap-2 text-xs">
              <span className="w-28 shrink-0 truncate font-semibold text-dim" title={String(r[labelKey])}>
                {format ? format(r[labelKey]) : pretty(r[labelKey])}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
                <span className="block h-full rounded-full bg-gold/70" style={{ width: `${Math.max(3, ((Number(r[valueKey]) || 0) / max) * 100)}%` }} />
              </span>
              <span className="w-14 shrink-0 text-right font-bold tabular-nums text-cream">{nf.format(Number(r[valueKey]) || 0)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AdminTraffic() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(14);
  const [err, setErr] = useState('');
  const [setup, setSetup] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const call = useCallback(async (body) => {
    const user = authClient().currentUser;
    if (!user) throw new Error('Please sign in again.');
    const token = await user.getIdToken();
    const res = await fetch('/api/admin/traffic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return res.json().catch(() => ({ ok: false, error: 'Bad answer from the server' }));
  }, []);

  const load = useCallback(async () => {
    setErr('');
    try {
      const j = await call({ days });
      if (j.setup) { setSetup(true); return; }
      if (!j.ok) { setErr(j.error || 'Could not load'); return; }
      setData(j);
    } catch (e) { setErr(e.message); }
  }, [call, days]);

  useEffect(() => { load(); }, [load]);

  const cleanup = async () => {
    if (!window.confirm('Delete analytics buckets older than 60 days? Counters only — orders are untouched.')) return;
    setBusy('cleanup'); setMsg('');
    try {
      const j = await call({ action: 'cleanup', keepDays: 60 });
      setMsg(j.ok ? `${j.removed} old buckets removed.` : j.error || 'Failed');
      await load();
    } finally { setBusy(''); }
  };

  const hoursMax = useMemo(() => Math.max(1, ...((data && data.hours) || [1])), [data]);

  if (setup) {
    return (
      <div className="card max-w-xl space-y-2">
        <h1 className="text-2xl font-extrabold">Traffic tracking ke liye Realtime Database chahiye</h1>
        <p className="text-sm text-dim">
          Firebase Console → Build → Realtime Database → <b>Create database</b>. Phir redeploy karein.
          Ye analytics usi free RTDB quota par chalta hai — Firestore bilkul nahi kharch hota.
        </p>
        <p className="text-xs text-faint">Task: <code>FIREBASE_DATABASE_URL</code> ya <code>NEXT_PUBLIC_FIREBASE_PROJECT_ID</code> set ho.</p>
      </div>
    );
  }

  if (!data) return <p className="flex items-center gap-2 text-dim"><Loader2 size={16} className="animate-spin" /> Traffic load ho raha hai…</p>;

  const t = data.today;
  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Traffic &amp; visitors</h1>
          <p className="text-sm text-dim">
            Server-side analytics: country, city, network, browser, OS aur device — masked IP ke saath.
            Goal: <b>{nf.format(data.goal)}</b> visitors/day.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-xl border border-line bg-raised px-3 py-2 text-sm font-bold text-cream">
            {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>Last {d} days</option>)}
          </select>
          <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-bold text-dim hover:border-gold hover:text-gold">
            <RefreshCw size={14} /> Refresh
          </button>
          <button type="button" onClick={cleanup} disabled={busy === 'cleanup'} className="rounded-xl border border-line px-3 py-2 text-sm font-bold text-dim hover:border-gold hover:text-gold disabled:opacity-50">
            {busy === 'cleanup' ? 'Cleaning…' : 'Cleanup 60d'}
          </button>
        </div>
      </div>

      {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{err}</p>}
      {msg && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{msg}</p>}

      {/* Goal ring */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative grid h-28 w-28 place-items-center">
            <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" className="text-raised" strokeWidth="4" />
              <circle
                cx="18" cy="18" r="15.9" fill="none" stroke="#F5B83D" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${t.goalPct} ${100 - t.goalPct}`}
              />
            </svg>
            <span className="text-center">
              <span className="block font-display text-lg font-extrabold tabular-nums text-cream">{t.goalPct}%</span>
              <span className="block text-[0.6rem] font-bold uppercase text-faint">of goal</span>
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-cream"><Target size={14} className="text-gold" /> Aaj ka goal</h2>
            <p className="mt-1 text-sm text-dim">
              <b className="text-cream">{nf.format(t.visitors)}</b> unique visitors · <b className="text-cream">{nf.format(t.views)}</b> page views
              {' '}— target <b>{nf.format(data.goal)}</b>/day.
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-raised">
              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, t.viewsGoalPct)}%` }} />
            </div>
            <p className="mt-1 text-[0.7rem] font-semibold text-faint">
              Views ka goal {t.viewsGoalPct}% · 7-day average {nf.format(data.totals.perDayAvg)} visitors/day
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Aaj visitors" value={nf.format(t.visitors)} sub={`${nf.format(t.views)} page views`} icon={Users} />
        <Stat label="7 din" value={nf.format(data.totals.last7Visitors)} sub={`${nf.format(data.totals.last7Views)} views`} icon={Activity} />
        <Stat label={`${data.days} din`} value={nf.format(data.totals.visitors)} sub={`${nf.format(data.totals.views)} views`} icon={BarChart3} />
        <Stat label="Top country" value={data.countries[0] ? `${FLAGS[data.countries[0].key] || '🌍'} ${data.countries[0].key}` : '—'} sub={data.countries[0] ? `${nf.format(data.countries[0].value)} views` : ''} icon={Globe2} />
      </div>

      {/* Hourly today */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-sm font-extrabold text-cream">Aaj ke 24 ghante (Pakistan time)</h2>
        <div className="flex h-24 items-end gap-1">
          {data.hours.map((v, i) => (
            <div key={i} className="group relative flex-1">
              <div className="w-full rounded-t bg-gold/70" style={{ height: `${Math.max(2, (v / hoursMax) * 88)}px` }} />
              <span className="absolute -top-5 left-1/2 hidden -translate-x-1/2 rounded bg-black px-1 text-[0.6rem] font-bold text-white group-hover:block">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[0.6rem] font-bold text-faint"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Table title="Countries" rows={data.countries} icon={Globe2} format={(k) => `${FLAGS[k] || '🌍'} ${k}`} />
        <Table title="Cities" rows={data.cities} icon={MapPin} format={(k) => (k === 'unknown' ? '—' : k)} />
        <Table title="Networks (masked IP /24)" rows={data.networks} icon={ShieldAlert} />
        <Table title="Top pages" rows={data.pages} icon={Activity} />
        <Table title="Referrers" rows={data.referrers} icon={Globe2} />
        <Table title="Browsers" rows={data.browsers} icon={Monitor} />
        <Table title="Operating systems" rows={data.systems} icon={Monitor} />
        <Table title="Devices" rows={data.devices} icon={Smartphone} />
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-1 text-sm font-extrabold text-cream">Recent visitors (aaj)</h2>
        <p className="mb-3 text-xs text-dim">
          {data.fullIp
            ? 'Full IP mode ON (ANALYTICS_FULL_IP=1). Privacy policy mein likhna zaroori hai.'
            : 'IP masked hai (aakhri octet 0). Full IP chahiye to ANALYTICS_FULL_IP=1 set karein — privacy policy update karein.'}
        </p>
        {data.recent.length === 0 ? (
          <p className="text-xs text-dim">Aaj ka koi record nahi. Page kholiye, 2 second baad refresh karein.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="text-[0.65rem] uppercase tracking-wider text-faint">
                <tr><th className="py-1.5">Kitna pehle</th><th>Desh</th><th>Shehar</th><th>IP</th><th>Browser</th><th>OS</th><th>Page</th><th>Source</th></tr>
              </thead>
              <tbody>
                {data.recent.map((r, i) => (
                  <tr key={`${r.t}-${i}`} className="border-t border-line/60">
                    <td className="py-1.5 font-bold text-cream">{ago(r.t)}</td>
                    <td>{FLAGS[r.cc] || '🌍'} {r.cc || 'XX'}</td>
                    <td className="max-w-[120px] truncate">{r.city || '—'}</td>
                    <td className="font-mono text-[0.68rem]">{r.ip || '—'}</td>
                    <td>{r.ua || '—'}</td>
                    <td>{r.os || '—'}</td>
                    <td className="max-w-[160px] truncate">{pretty(r.page)}</td>
                    <td>{r.ref || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-faint">
        Ye page sirf admin ke liye hai. Numbers server ke headers se aate hain (Vercel: <code>x-vercel-ip-country</code>, Cloudflare: <code>cf-ipcountry</code>) —
        local <code>next dev</code> par country empty ho sakta hai. <Link href="/admin/dashboard" className="font-bold text-gold hover:underline">Live dashboard</Link> bhi dekhein.
      </p>
    </div>
  );
}
