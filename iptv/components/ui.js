'use client';
import { useEffect } from 'react';
import { X, Check, ChevronDown, Sparkles } from 'lucide-react';

export function Logo({ size = 38, withText = false, sub = 'CONTROL ROOM' }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative grid place-items-center overflow-hidden rounded-[13px]"
        style={{
          width: size, height: size,
          background: 'linear-gradient(140deg,#ffe6a8,#f5b83d 45%,#0e9b68)',
          boxShadow: '0 10px 26px -12px rgba(245,184,61,.75)',
        }}>
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 19V7.6c0-.9 1-1.4 1.8-1L12 9.8l6.2-3.2c.8-.4 1.8.1 1.8 1V19" stroke="#062015" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.4 15.6 15.8 18l-5.4 2.4v-4.8Z" fill="#062015" opacity=".85" />
        </svg>
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/40 to-transparent opacity-40" />
      </span>
      {withText && (
        <span className="leading-none">
          <b className="block text-[15px] font-extrabold tracking-tight">MIZANORA</b>
          <small className="text-[9px] font-bold tracking-[0.28em] text-gold">{sub}</small>
        </span>
      )}
    </div>
  );
}

export function Btn({ variant = 'default', size, className = '', children, ...rest }) {
  const v = variant === 'primary' ? 'btn-primary' : variant === 'gold' ? 'btn-gold' : variant === 'ghost' ? 'btn-ghost'
    : variant === 'danger' ? 'btn-danger' : variant === 'icon' ? 'btn btn-icon' : '';
  return (
    <button {...rest} className={`btn ${v} ${size === 'sm' ? 'btn-sm' : ''} ${className}`}>{children}</button>
  );
}

export function Badge({ tone = 'muted', dot, children, className = '' }) {
  const cls = { live: 'b-live', gold: 'b-gold', off: 'b-off', muted: 'b-muted', info: 'b-info', violet: 'b-violet' }[tone] || 'b-muted';
  return (
    <span className={`badge ${cls} ${className}`}>
      {dot && <i className="inline-block h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function SectionHead({ title, sub, actions, icon: Icon }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight sm:text-xl">
          {Icon && <Icon size={18} className="text-gold" />}{title}
        </h2>
        {sub && <p className="mt-0.5 text-xs text-dim">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Progress({ value, tone = '#14b87a', height = 6, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-full bg-white/10 ${className}`} style={{ height }}>
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: `linear-gradient(90deg,${tone}88,${tone})` }} />
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line bg-white/[0.03] px-3.5 py-3">
      <span>
        <b className="block text-sm font-semibold">{label}</b>
        {hint && <small className="text-[11px] text-faint">{hint}</small>}
      </span>
      <span onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-emerald' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </label>
  );
}

export function Tabs({ items, value, onChange, className = '' }) {
  return (
    <div className={`inline-flex rounded-xl border border-line bg-black/25 p-1 ${className}`}>
      {items.map((it) => {
        const id = typeof it === 'string' ? it : it.id;
        const label = typeof it === 'string' ? it : it.label;
        return (
          <button key={id} onClick={() => onChange(id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${value === id ? 'bg-white/10 text-cream shadow' : 'text-dim hover:text-cream'}`}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({ open, onClose, title, sub, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className={`pop-in relative z-10 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} overflow-hidden rounded-2xl border border-line bg-[#071410] shadow-2xl`}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h3 className="text-base font-extrabold">{title}</h3>
            {sub && <p className="mt-0.5 text-xs text-dim">{sub}</p>}
          </div>
          <button onClick={onClose} className="btn btn-icon btn-ghost"><X size={16} /></button>
        </div>
        <div className="max-h-[72vh] overflow-y-auto scroll-thin p-5">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, sub, children }) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90]">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <aside className="slide-in absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-line bg-[#06120c] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h3 className="text-base font-extrabold">{title}</h3>
            {sub && <p className="mt-0.5 text-xs text-dim">{sub}</p>}
          </div>
          <button onClick={onClose} className="btn btn-icon btn-ghost"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin p-5">{children}</div>
      </aside>
    </div>
  );
}

/** Tiny toast that slides up from the bottom. */
export function Toast({ msg, onDone, tone = 'emerald' }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => onDone?.(), 2600);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  if (!msg) return null;
  return (
    <div className="fixed bottom-5 left-1/2 z-[120] -translate-x-1/2 pop-in">
      <div className="flex items-center gap-2 rounded-full border border-line bg-[#0a1c13] px-4 py-2.5 text-sm font-semibold shadow-2xl">
        <span className="grid h-5 w-5 place-items-center rounded-full" style={{ background: tone === 'gold' ? '#f5b83d' : '#14b87a' }}>
          <Check size={12} className="text-[#04100a]" />
        </span>
        {msg}
      </div>
    </div>
  );
}

export function Avatar({ name, tone = 'emerald', size = 34 }) {
  const initials = name.split(/[\s_.-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const bg = tone === 'gold' ? 'linear-gradient(140deg,#ffe6a8,#f5b83d)' : tone === 'violet' ? 'linear-gradient(140deg,#d8c7ff,#a78bfa)' : 'linear-gradient(140deg,#9df3cd,#14b87a)';
  return (
    <span className="grid shrink-0 place-items-center rounded-xl font-extrabold text-[#04170e]"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.36 }}>{initials || 'M'}</span>
  );
}

export function Select({ value, onChange, options, className = '', ...rest }) {
  return (
    <div className={`relative ${className}`}>
      <select value={value} onChange={onChange} className="select" {...rest}>
        {options.map((o) => <option key={o} value={o} className="bg-[#071410]">{o}</option>)}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint" />
    </div>
  );
}

export function Hint({ children }) {
  return (
    <p className="flex items-start gap-1.5 rounded-xl border border-gold/20 bg-gold/[0.06] px-3 py-2 text-[11px] leading-relaxed text-goldsoft/80">
      <Sparkles size={12} className="mt-0.5 shrink-0" />{children}
    </p>
  );
}
