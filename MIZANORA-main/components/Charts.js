'use client';

// Small dependency-free SVG charts for the admin dashboard.
const COLORS = ['#0B6B45', '#F2A007', '#2563EB', '#DC2626', '#7C3AED'];
const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(Math.round(n)));

// lines: [{ name, values: [..], color? }], labels: [..]
export function LineChart({ lines, labels, height = 170 }) {
  const W = 640, H = height, pl = 38, pr = 8, pt = 10, pb = 22;
  const max = Math.max(1, ...lines.flatMap((l) => l.values));
  const x = (i) => pl + (labels.length < 2 ? 0 : (i * (W - pl - pr)) / (labels.length - 1));
  const y = (v) => pt + (1 - v / max) * (H - pt - pb);
  const step = Math.ceil(labels.length / 7);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={lines.map((l) => l.name).join(', ')}>
        {[0, 0.5, 1].map((f) => <g key={f}><line x1={pl} x2={W - pr} y1={y(max * f)} y2={y(max * f)} stroke="currentColor" opacity="0.12" /><text x={pl - 4} y={y(max * f) + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.6">{fmt(max * f)}</text></g>)}
        {lines.map((l, k) => <polyline key={l.name} fill="none" stroke={l.color || COLORS[k % COLORS.length]} strokeWidth="2.5" strokeLinejoin="round" points={l.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />)}
        {labels.map((t, i) => (i % step === 0 ? <text key={t} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">{String(t).slice(5)}</text> : null))}
      </svg>
      <p className="flex flex-wrap gap-3 text-xs">{lines.map((l, k) => <span key={l.name} className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: l.color || COLORS[k % COLORS.length] }} />{l.name}</span>)}</p>
    </div>
  );
}

// bars: [{ label, value }]
export function BarChart({ bars, height = 150, color = '#0B6B45' }) {
  const W = 640, H = height, pl = 34, pb = 20, pt = 8;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const bw = (W - pl) / Math.max(1, bars.length);
  const step = Math.ceil(bars.length / 12);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      <text x={pl - 4} y={pt + 8} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.6">{fmt(max)}</text>
      <line x1={pl} x2={W} y1={H - pb} y2={H - pb} stroke="currentColor" opacity="0.15" />
      {bars.map((b, i) => { const h = (b.value / max) * (H - pb - pt); return <g key={i}><rect x={pl + i * bw + 2} y={H - pb - h} width={Math.max(2, bw - 4)} height={h} rx="2" fill={color}><title>{`${b.label}: ${b.value}`}</title></rect>{i % step === 0 && <text x={pl + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">{b.label}</text>}</g>; })}
    </svg>
  );
}

// Horizontal list with bars: items = [{ k, v }]
export function TopList({ items, empty = 'No data yet', color = '#0B6B45', pretty = (k) => k }) {
  if (!items || !items.length) return <p className="text-sm text-dim">{empty}</p>;
  const max = Math.max(1, ...items.map((i) => i.v));
  return (
    <ul className="space-y-1.5">
      {items.map((i) => (
        <li key={i.k} className="text-sm">
          <div className="flex justify-between gap-2"><span className="truncate">{pretty(i.k)}</span><b>{i.v.toLocaleString('en-PK')}</b></div>
          <div className="h-1.5 rounded-full bg-raised"><div className="h-1.5 rounded-full" style={{ width: `${(i.v / max) * 100}%`, background: color }} /></div>
        </li>
      ))}
    </ul>
  );
}
