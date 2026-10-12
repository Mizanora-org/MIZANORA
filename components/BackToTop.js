'use client';
import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

// A small round button that appears after you scroll down and takes you back to the top.
export default function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setShow(window.scrollY > 700)); };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, []);
  if (!show) return null;
  return (
    <button type="button" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-36 right-3 z-30 grid h-11 w-11 place-items-center rounded-full border border-line bg-white text-gold shadow-lg transition hover:bg-gold hover:text-white md:bottom-24 md:right-5" style={{ animation: 'mz-pop .3s ease-out' }}>
      <ArrowUp size={20} />
    </button>
  );
}
