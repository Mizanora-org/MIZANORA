'use client';
import { useEffect, useRef, useState } from 'react';

/** Fades + lifts its children in when they enter the viewport. */
export default function Reveal({ children, delay = 0, className = '', as: Tag = 'div', once = true }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { setSeen(true); if (once) io.disconnect(); }
        else if (!once) setSeen(false);
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -40px' });
    io.observe(el);
    return () => io.disconnect();
  }, [once]);
  return (
    <Tag ref={ref} className={`reveal ${seen ? 'in' : ''} ${className}`} style={{ '--d': `${delay}ms` }}>
      {children}
    </Tag>
  );
}
