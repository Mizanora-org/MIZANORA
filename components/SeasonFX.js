'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { seasonFor } from '@/lib/season';

// Soft falling leaves (autumn), snow (winter) or petals (spring) over the whole shop.
// It never blocks taps, is switched off for people who prefer reduced motion, and is hidden on admin and checkout pages.
const LEAVES = [
  'M12 2C18 6 20 12 12 22C4 12 6 6 12 2Z',
  'M12 2l2 4 4-1-1 4 4 2-3 2 1 4-4-1-3 4-3-4-4 1 1-4-3-2 4-2-1-4 4 1z',
  'M3 21C3 10 10 3 21 3c0 11-7 18-18 18z',
];

function Shape({ kind, size, color, variant }) {
  if (kind === 'snow') return <span className="block rounded-full" style={{ width: size / 2, height: size / 2, background: color, opacity: 0.9, boxShadow: '0 0 6px rgba(255,255,255,.9)' }} />;
  if (kind === 'petal') return <span className="block" style={{ width: size * 0.6, height: size * 0.85, background: color, borderRadius: '70% 0 70% 0', opacity: 0.85 }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ opacity: 0.9 }}>
      <path d={LEAVES[variant % LEAVES.length]} fill={color} />
      <path d="M12 4v16" stroke="rgba(0,0,0,.25)" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

export default function SeasonFX() {
  const path = usePathname() || '/';
  const [fx, setFx] = useState(null);

  useEffect(() => {
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (_) {}
    const s = seasonFor();
    if (!s || !s.particles) return;
    const count = window.innerWidth < 640 ? 11 : 20;
    setFx({
      kind: s.particles,
      items: Array.from({ length: count }, (_, i) => {
        const dur = 11 + Math.random() * 11;
        return {
          id: i, left: Math.random() * 100, size: 14 + Math.random() * 16, dur, delay: -Math.random() * dur,
          sway: 3 + Math.random() * 3.5, color: s.colors[i % s.colors.length], variant: i,
        };
      }),
    });
  }, []);

  if (!fx || /^\/(admin|checkout)/.test(path)) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[35] overflow-hidden">
      {fx.items.map((p) => (
        <span key={p.id} className="absolute top-0 block" style={{ left: `${p.left}%`, animation: `mz-fall-y ${p.dur}s linear ${p.delay}s infinite`, willChange: 'transform' }}>
          <span className="block" style={{ animation: `mz-sway ${p.sway}s ease-in-out ${p.delay}s infinite alternate` }}>
            <Shape kind={fx.kind} size={p.size} color={p.color} variant={p.variant} />
          </span>
        </span>
      ))}
    </div>
  );
}
