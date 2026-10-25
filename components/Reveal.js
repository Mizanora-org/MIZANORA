'use client';
import { useEffect, useRef } from 'react';

// Fades a section in as it scrolls into view. Content is always visible without JavaScript:
// it is hidden only if it starts below the screen, and revealed the moment it comes into view.
export default function Reveal({ children = null, className = '', delay = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.92) return undefined; // already on screen: leave it alone
    el.dataset.r = '0';
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { el.style.transitionDelay = `${delay}ms`; el.dataset.r = '1'; io.disconnect(); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return <div ref={ref} className={className}>{children}</div>;
}
