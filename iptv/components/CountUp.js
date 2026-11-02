'use client';
import { useEffect, useRef, useState } from 'react';

const ease = (t) => 1 - Math.pow(1 - t, 3);

export default function CountUp({ value, duration = 1100, prefix = '', suffix = '', decimals = 0, className = '' }) {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const run = () => {
      if (started.current) return;
      started.current = true;
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / duration);
        setN(value * ease(p));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if (typeof IntersectionObserver === 'undefined') { run(); return; }
    const io = new IntersectionObserver((e) => e.forEach((x) => x.isIntersecting && run()), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  const shown = decimals ? n.toFixed(decimals) : Math.round(n).toLocaleString('en-PK');
  return <span ref={ref} className={className}>{prefix}{shown}{suffix}</span>;
}
