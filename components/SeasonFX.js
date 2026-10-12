'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { seasonFor } from '@/lib/season';

// Soft falling leaves (autumn), snow (winter) or petals (spring).
// Built to stay smooth: few elements, only transform is animated, weak phones get fewer leaves (or none),
// it pauses while the page is scrolling fast or the tab is hidden, and visitors can switch it off (footer button, remembered).
const LEAVES = [
  'M12 2C18 6 20 12 12 22C4 12 6 6 12 2Z',
  'M12 2l2 4 4-1-1 4 4 2-3 2 1 4-4-1-3 4-3-4-4 1 1-4-3-2 4-2-1-4 4 1z',
  'M3 21C3 10 10 3 21 3c0 11-7 18-18 18z',
];

function Shape({ kind, size, color, variant }) {
  if (kind === 'snow') return <span className="block rounded-full" style={{ width: size / 2, height: size / 2, background: color, opacity: 0.9 }} />;
  if (kind === 'petal') return <span className="block" style={{ width: size * 0.6, height: size * 0.85, background: color, borderRadius: '70% 0 70% 0', opacity: 0.85 }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ opacity: 0.9 }}>
      <path d={LEAVES[variant % LEAVES.length]} fill={color} />
    </svg>
  );
}

// How many leaves this device can handle comfortably.
function budget() {
  try {
    const n = navigator;
    const cores = n.hardwareConcurrency || 4;
    const mem = n.deviceMemory || 4;
    const slow = n.connection && (n.connection.saveData || /(^|-)2g$/.test(n.connection.effectiveType || ''));
    if (slow) return 0;
    let count = window.innerWidth < 640 ? 7 : 14;
    if (cores <= 4 || mem <= 2) count = Math.min(count, 5);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) count = Math.min(count, 5); // calmer, but still there
    return count;
  } catch (_) { return 6; }
}

export default function SeasonFX() {
  const path = usePathname() || '/';
  const [fx, setFx] = useState(null);
  const [off, setOff] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try { setOff(localStorage.getItem('mz_fx') === 'off'); } catch (_) {}
    const toggle = (e) => setOff(Boolean(e.detail && e.detail.off));
    window.addEventListener('mz-fx', toggle);
    const vis = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('mz-fx', toggle); document.removeEventListener('visibilitychange', vis); };
  }, []);

  useEffect(() => {
    const s = seasonFor();
    if (!s || !s.particles) return;
    const count = budget();
    if (!count) return;
    setFx({
      kind: s.particles,
      items: Array.from({ length: count }, (_, i) => {
        const dur = 14 + Math.random() * 10;
        return { id: i, left: 2 + Math.random() * 96, size: 16 + Math.random() * 14, dur, delay: -Math.random() * dur, sway: 4 + Math.random() * 3, color: s.colors[i % s.colors.length], variant: i };
      }),
    });
  }, []);

  if (!fx || off || hidden || /^\/(admin|checkout|reels)/.test(path)) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[35] overflow-hidden" style={{ contain: 'strict' }}>
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
