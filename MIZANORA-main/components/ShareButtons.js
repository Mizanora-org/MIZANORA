'use client';
import { useState } from 'react';
import { Check, Copy, Facebook, Share2 } from 'lucide-react';
import { WhatsAppIcon } from './Icons';

// Share the product link on WhatsApp / Facebook, copy it, or use the phone's own share sheet. Shared links bring free visitors.
export default function ShareButtons({ url, title }) {
  const [copied, setCopied] = useState(false);
  const text = `${title} on Mizanora`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); } catch (_) {
      const t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (__) {} t.remove();
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const native = async () => { try { await navigator.share({ title: text, url }); } catch (_) {} };
  const b = 'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-cream hover:border-gold';
  return (
    <div className="mt-5">
      <p className="mb-2 text-sm font-semibold text-dim">Share this product</p>
      <div className="flex flex-wrap items-center gap-2">
        <a className={b} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`}><WhatsAppIcon size={16} /> WhatsApp</a>
        <a className={b} target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}><Facebook size={16} /> Facebook</a>
        <button type="button" className={b} onClick={copy}>{copied ? <><Check size={16} className="text-gold" /> Copied!</> : <><Copy size={16} /> Copy link</>}</button>
        {typeof navigator !== 'undefined' && navigator.share && <button type="button" className={b} onClick={native}><Share2 size={16} /> More</button>}
      </div>
    </div>
  );
}
