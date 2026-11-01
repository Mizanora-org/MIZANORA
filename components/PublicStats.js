'use client';
import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';

// v37: the public numbers, drawn as graphs. Refreshes by itself every minute and shows a live
// dot while people are on the site. Everything here is a total - see /api/stats for the promise.

const nf = new Intl.NumberFormat('en-PK');

function Sparkline({ series, height = 90 }) {
  const max = Math.max(1, ...series.map((s) => s.views));
  const w = 100;
  const step = series.length > 1 ? w / (series.length - 1) : w;
  const pts = series.map((s, i) => [i * step, height - (s.views / max) * (height - 8) - 4]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  const area = `${line} L${w} ${height} L0 ${height} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="h-24 w-full" role="img" aria-label={`Page views over the last ${series.length} days`}>
      <path d={area} fill="rgba(212,160,23,.14)" />
      <path d={line} fill="none" stroke="#d4a017" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

const pct = (n, total) => (total > 0 ? Math.round((n / total) * 100) : 0);

export default function PublicStats() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('/api/stats', { cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        if (alive) { setD(j); setErr(j.setup || !j.ok ? '' : ''); }
      } catch (e) { if (alive) setErr('Could not load the numbers.'); }
    };
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (err) return <p className="rounded-2xl border border-line bg-surface p-6 text-dim">{err}</p>;
  if (!d) return <p className="rounded-2xl border border-line bg-surface p-6 text-dim">Loading the numbers…</p>;

  if (d.setup) {
    return (
      <p className="rounded-2xl border border-line bg-surface p-6 text-dim">
        Live numbers are not switched on for this shop yet. Everything else works exactly the same.
      </p>
    );
  }

  const series = Array.isArray(d.series) ? d.series : [];
  const devices = Array.isArray(d.devices) ? d.devices : [];
  const sources = Array.isArray(d.sources) ? d.sources : [];
  const pages = Array.isArray(d.topPages) ? d.topPages : [];
  const devTotal = devices.reduce((a, x) => a + x.v, 0);
  const online = Number(d.online) || 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card !p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-dim">
            <span className={`inline-block h-2 w-2 rounded-full ${online ? 'animate-pulse bg-red-500' : 'bg-faint'}`} aria-hidden="true" />
            On the site now
          </p>
          <p className="mt-1 font-display text-4xl font-extrabold text-gold">{nf.format(online)}</p>
          <p className="text-xs text-faint">{online ? <><Radio size={10} className="inline" /> live, refreshed every minute</> : 'nobody right now'}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-dim">Page views today</p>
          <p className="mt-1 font-display text-4xl font-extrabold text-gold">{nf.format(d.today?.views || 0)}</p>
          <p className="text-xs text-faint">{nf.format(d.today?.uv || 0)} visitors (Pakistan day)</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-dim">Last 14 days</p>
          <p className="mt-1 font-display text-4xl font-extrabold text-gold">{nf.format(d.totals?.views || 0)}</p>
          <p className="text-xs text-faint">{nf.format(d.totals?.uv || 0)} visitors</p>
        </div>
      </div>

      <section className="card">
        <h2 className="mb-1 text-base font-extrabold">Traffic, last 14 days</h2>
        {series.some((s) => s.views > 0) ? (
          <>
            <Sparkline series={series} />
            <div className="mt-1 flex justify-between text-[0.65rem] text-faint">
              <span>{series[0]?.d?.slice(5)}</span>
              <span>{series[series.length - 1]?.d?.slice(5)}</span>
            </div>
          </>
        ) : <p className="text-sm text-dim">No traffic recorded yet.</p>}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card">
          <h2 className="mb-2 text-base font-extrabold">Most-read pages</h2>
          {pages.length ? (
            <ol className="space-y-1.5 text-sm">
              {pages.map((p, i) => {
                const max = Math.max(...pages.map((x) => x.v));
                return (
                  <li key={p.path}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate"><b className="text-faint">{i + 1}.</b> {p.path}</span>
                      <b className="shrink-0 text-gold">{nf.format(p.v)}</b>
                    </div>
                    <span className="mt-0.5 block h-1 rounded-full bg-raised"><i className="block h-1 rounded-full bg-gold" style={{ width: `${Math.max(3, (p.v / max) * 100)}%` }} /></span>
                  </li>
                );
              })}
            </ol>
          ) : <p className="text-sm text-dim">Nothing recorded yet.</p>}
        </section>

        <section className="card space-y-4">
          <div>
            <h2 className="mb-2 text-base font-extrabold">Devices</h2>
            {devices.length ? (
              <div className="space-y-1.5 text-sm">
                {devices.map((x) => (
                  <div key={x.k} className="flex items-center justify-between gap-2">
                    <span className="capitalize">{x.k}</span>
                    <span className="flex items-center gap-2"><i className="h-1.5 w-16 rounded-full bg-raised"><i className="block h-1.5 rounded-full bg-gold" style={{ width: `${pct(x.v, devTotal)}%` }} /></i><b className="w-8 text-right text-gold">{pct(x.v, devTotal)}%</b></span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-dim">Nothing recorded yet.</p>}
          </div>
          <div>
            <h2 className="mb-2 text-base font-extrabold">Where people come from</h2>
            {sources.length ? (
              <ul className="space-y-1 text-sm">
                {sources.map((x) => <li key={x.k} className="flex items-center justify-between gap-2"><span className="truncate capitalize">{x.k}</span><b className="text-gold">{nf.format(x.v)}</b></li>)}
              </ul>
            ) : <p className="text-sm text-dim">Nothing recorded yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
