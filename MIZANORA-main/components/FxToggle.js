'use client';
import { useEffect, useState } from 'react';
import { Leaf } from 'lucide-react';

// Footer switch for the falling leaves, so anyone with a slow phone can turn the effect off (remembered on that device).
export default function FxToggle() {
  const [off, setOff] = useState(false);
  useEffect(() => { try { setOff(localStorage.getItem('mz_fx') === 'off'); } catch (_) {} }, []);
  const flip = () => {
    const next = !off;
    setOff(next);
    try { localStorage.setItem('mz_fx', next ? 'off' : 'on'); } catch (_) {}
    window.dispatchEvent(new CustomEvent('mz-fx', { detail: { off: next } }));
  };
  return (
    <button type="button" onClick={flip} aria-pressed={!off} className="mx-auto mt-3 flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-dim hover:border-gold hover:text-gold">
      <Leaf size={14} /> Seasonal animation: {off ? 'Off' : 'On'}
    </button>
  );
}
