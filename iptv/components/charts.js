'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

const smooth = (pts) => {
  if (!pts.length) return '';
  if (pts.length < 3) return `M${pts.map((p) => p.join(',')).join(' L')}`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    d += ` Q${x0},${y0} ${(x0 + x1) / 2},${(y0 + y1) / 2}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last[0]},${last[1]}`;
};

export function Spark({ data, color = '#14b87a', height = 46, fill = true, strokeWidth = 2 }) {
  const w = 160;
  const h = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 4 - ((v - min) / span) * (h - 10)]);
  const line = smooth(pts);
  const id = useMemo(() => `sp${Math.random().toString(36).slice(2, 7)}`, []);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".38" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AreaChart({ data, labels = [], color = '#14b87a', height = 210, format = (v) => v }) {
  const [hover, setHover] = useState(null);
  const w = 720;
  const h = height;
  const padB = 26;
  const max = Math.max(...data) * 1.12;
  const min = 0;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - padB - ((v - min) / (max - min)) * (h - padB - 12)]);
  const line = smooth(pts);
  const id = useMemo(() => `ar${Math.random().toString(36).slice(2, 7)}`, []);
  const hoverPt = hover != null ? pts[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * w;
          setHover(Math.max(0, Math.min(data.length - 1, Math.round((x / w) * (data.length - 1)))));
        }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".42" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1="0" x2={w} y1={12 + (h - padB - 12) * g} y2={12 + (h - padB - 12) * g}
            stroke="rgba(255,255,255,.06)" strokeDasharray="3 6" />
        ))}
        <path d={`${line} L${w},${h - padB} L0,${h - padB} Z`} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 6px 16px ${color}55)` }} />
        {hoverPt && (
          <>
            <line x1={hoverPt[0]} x2={hoverPt[0]} y1="10" y2={h - padB} stroke="rgba(245,184,61,.4)" strokeDasharray="3 4" />
            <circle cx={hoverPt[0]} cy={hoverPt[1]} r="5" fill={color} stroke="#04100a" strokeWidth="2.5" />
          </>
        )}
        {labels.map((l, i) => (
          <text key={l} x={(i / (labels.length - 1)) * w} y={h - 6} textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}
            fill="rgba(226,240,232,.34)" fontSize="11">{l}</text>
        ))}
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute -top-1 rounded-lg border border-line bg-[#071410]/95 px-2.5 py-1 text-xs font-semibold text-cream shadow-lg"
          style={{ left: `${(hover / (data.length - 1)) * 100}%`, transform: 'translateX(-50%)' }}>
          {format(data[hover])}
        </div>
      )}
    </div>
  );
}

export function Bars({ data, height = 110, color = '#f5b83d' }) {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((v, i) => (
        <div key={i} className="group relative flex-1 rounded-t-md transition-all duration-500 hover:opacity-100"
          style={{
            height: `${Math.max(8, (v / max) * 100)}%`,
            background: `linear-gradient(180deg, ${color}, ${color}22)`,
            opacity: 0.55 + (v / max) * 0.45,
            animation: `reveal-in .7s ${i * 25}ms both`,
          }}>
          <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] group-hover:block">{v}</span>
        </div>
      ))}
    </div>
  );
}

export function Ring({ value, size = 116, stroke = 10, tone = '#f5b83d', label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [p, setP] = useState(0);
  useEffect(() => { const t = setTimeout(() => setP(value), 120); return () => clearTimeout(t); }, [value]);
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * p) / 100}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.22,.9,.24,1)', filter: `drop-shadow(0 0 10px ${tone}66)` }} />
      </svg>
      <div className="absolute text-center">
        <div className="num text-xl font-extrabold">{label ?? `${value}%`}</div>
        {sub && <div className="text-[10px] uppercase tracking-wider text-faint">{sub}</div>}
      </div>
    </div>
  );
}

export function Gauge({ value, tone = '#14b87a' }) {
  const r = 40; const c = Math.PI * r; const off = c - (c * Math.min(100, value)) / 100;
  return (
    <svg viewBox="0 0 100 58" className="w-full" style={{ maxWidth: 120 }}>
      <path d={`M10,50 A${r},${r} 0 0 1 90,50`} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="9" strokeLinecap="round" />
      <path d={`M10,50 A${r},${r} 0 0 1 90,50`} fill="none" stroke={tone} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 1.1s ease' }} />
      <text x="50" y="46" textAnchor="middle" fill="#f2f7f3" fontSize="17" fontWeight="800">{Math.round(value)}%</text>
    </svg>
  );
}

export function EQ({ bars = 4, color = 'currentColor' }) {
  return (
    <span className="eq" style={{ color }}>
      {Array.from({ length: bars }).map((_, i) => (
        <i key={i} style={{ animationDelay: `${i * 0.14}s`, animationDuration: `${0.9 + (i % 3) * 0.18}s` }} />
      ))}
    </span>
  );
}
