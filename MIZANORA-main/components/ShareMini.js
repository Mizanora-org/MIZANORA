'use client';
import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

// Small share button on product cards: opens the phone's share sheet, or copies the link.
export default function ShareMini({ slug, name, className = '' }) {
  const [done, setDone] = useState(false);
  const share = async (e) => {
    e.preventDefault(); e.stopPropagation();
    const url = `${window.location.origin}/product/${slug}`;
    try { if (navigator.share) { await navigator.share({ title: name, url }); return; } } catch (_) { return; }
    try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 1600); } catch (_) {}
  };
  return (
    <button type="button" onClick={share} aria-label={done ? 'Link copied' : `Share ${name}`}
      className={`grid h-8 w-8 place-items-center rounded-full border border-line bg-white/95 text-faint shadow-sm hover:text-gold active:scale-90 ${className}`}>
      {done ? <Check size={16} className="text-gold" /> : <Share2 size={16} />}
    </button>
  );
}
