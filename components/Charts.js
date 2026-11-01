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

// v38: the dashboard's new blocks.
// A two-slice ring: new vs returning visitors. Dependency-free, one <svg>, no library.
export function Donut({ parts, size = 150, thickness = 22 }) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" opacity="0.12" strokeWidth={thickness} />
          {total > 0 && parts.map((p) => {
            const len = (Math.max(0, p.value) / total) * c;
            const el = <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} strokeLinecap="butt"><title>{`${p.label}: ${p.value.toLocaleString('en-PK')}`}</title></circle>;
            offset += len;
            return el;
          })}
        </g>
        <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fontSize="20" fontWeight="800" fill="currentColor">{total.toLocaleString('en-PK')}</text>
        <text x={size / 2} y={size / 2 + 15} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">visitors</text>
      </svg>
      <ul className="space-y-1 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
            <span className="text-dim">{p.label}</span>
            <b>{p.value.toLocaleString('en-PK')}</b>
            <span className="text-xs text-faint">{total ? `${Math.round((p.value / total) * 100)}%` : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// A bar that grows to the right: kinder to long labels ("Most read pages") than a column chart.
export function HBarChart({ bars, color = '#0B6B45', empty = 'No data yet' }) {
  if (!bars || !bars.length) return <p className="text-sm text-dim">{empty}</p>;
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <ul className="space-y-1">
      {bars.map((b, i) => (
        <li key={`${b.label}-${i}`} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-2 text-xs sm:grid-cols-[minmax(0,14rem)_1fr_auto]">
          <span className="truncate text-dim" title={b.label}>{b.label}</span>
          <span className="h-3 rounded-full bg-raised">
            <span className="block h-3 rounded-full" style={{ width: `${(b.value / max) * 100}%`, background: color }} />
          </span>
          <b className="tabular-nums">{b.value.toLocaleString('en-PK')}</b>
        </li>
      ))}
    </ul>
  );
}
