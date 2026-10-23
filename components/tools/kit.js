'use client';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

// Small building blocks shared by every tool (v25).
export function Field({ label, children, hint }) {
  return <label className="block text-sm"><span className="label">{label}</span>{children}{hint ? <span className="mt-1 block text-xs text-faint">{hint}</span> : null}</label>;
}
export function NumIn({ label, value, onChange, hint, placeholder = '0' }) {
  return <Field label={label} hint={hint}><input className="input" inputMode="decimal" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value.replace(/[^0-9.,-]/g, ''))} /></Field>;
}
export function TextIn({ label, value, onChange, rows = 0, placeholder = '', hint, mono }) {
  return <Field label={label} hint={hint}>{rows ? <textarea className={`input ${mono ? 'font-mono text-sm' : ''}`} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /> : <input className={`input ${mono ? 'font-mono' : ''}`} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}</Field>;
}
export function Sel({ label, value, onChange, options }) {
  return <Field label={label}><select className="input" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>))}</select></Field>;
}
export function Copy1({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="btn-ghost !px-3 !py-1.5 text-sm inline-flex items-center gap-1" onClick={async () => { try { await navigator.clipboard.writeText(String(text)); setDone(true); setTimeout(() => setDone(false), 1500); } catch (_) { /* blocked */ } }}>{done ? <Check size={15} /> : <Copy size={15} />}{done ? 'Copied' : label}</button>;
}
export function Result({ rows, big }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-[#0B6B45] to-[#06402a] p-4 text-white">
      {big ? <p className="text-3xl font-extrabold text-[#F5B83D] sm:text-4xl">{big}</p> : null}
      <dl className="mt-1 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">{rows.filter(Boolean).map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-white/10 py-1"><dt className="text-white/75">{k}</dt><dd className="font-bold">{v}</dd></div>)}</dl>
    </div>
  );
}
export const Row = ({ children }) => <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
export const Note = ({ children }) => <p className="mt-3 rounded-xl bg-raised p-3 text-xs text-dim">{children}</p>;
