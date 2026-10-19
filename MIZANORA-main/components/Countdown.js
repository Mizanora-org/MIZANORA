'use client';
import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';

const two = (n) => String(n).padStart(2, '0');
// Live countdown to the end of a sale. After it ends the shop returns to the normal price on its own.
export default function Countdown({ endsMs, compact = false, className = '' }) {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, endsMs - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endsMs]);
  if (left === null || left <= 0) return null;
  const s = Math.floor(left / 1000);
  const d = Math.floor(s / 86400);
  const txt = `${d > 0 ? `${d}d ` : ''}${two(Math.floor((s % 86400) / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;
  if (compact) return <p className={`mt-1 flex items-center gap-1 text-[0.7rem] font-bold text-red-600 ${className}`}><Timer size={12} /> Ends in {txt}</p>;
  return <p className={`inline-flex items-center gap-2 rounded-full bg-red-50 px-3.5 py-1.5 text-sm font-bold text-red-700 ${className}`}><Timer size={16} /> Sale ends in <span className="tabular-nums">{txt}</span></p>;
}
