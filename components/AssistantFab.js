'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';

// The panel (chat, voice, cards) is only downloaded when someone taps the button, so the shop stays fast.
const Panel = dynamic(() => import('./AssistantPanel'), { ssr: false, loading: () => null });

// Round assistant button, placed above the WhatsApp button.
export default function AssistantFab({ cfg }) {
  const path = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hint, setHint] = useState(false);
  const [query, setQuery] = useState('');

  const show = (q = '') => { setQuery(q); setMounted(true); setOpen(true); setHint(false); };

  useEffect(() => {
    const onAsk = (e) => show((e.detail && e.detail.q) || '');
    window.addEventListener('mz-assistant', onAsk);
    let t1; let t2;
    try {
      if (!sessionStorage.getItem('mz_ai_hint')) {
        t1 = setTimeout(() => { setHint(true); sessionStorage.setItem('mz_ai_hint', '1'); }, 5000);
        t2 = setTimeout(() => setHint(false), 12000);
      }
    } catch (_) { /* private mode */ }
    return () => { window.removeEventListener('mz-assistant', onAsk); clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!cfg || !cfg.enabled || /^\/(admin|worker)/.test(path)) return null;
  return (
    <>
      {!open && (
        <div className="fixed bottom-[8.4rem] right-3 z-30 flex items-center gap-2 md:bottom-[5.2rem] md:right-5">
          {hint && <span className="mz-rise rounded-2xl rounded-br-sm bg-white px-3 py-2 text-xs font-semibold text-cream shadow-lg ring-1 ring-line">{cfg.name} se sawal poochein</span>}
          <button type="button" onClick={() => show('')} aria-label={`Talk to ${cfg.name}, the Mizanora assistant`}
            className="relative grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#0E8556] to-[#0B6B45] text-white shadow-xl ring-2 ring-gold/70 active:scale-95">
            <span className="absolute inset-0 animate-ping rounded-full bg-gold/30 [animation-duration:2.6s]" aria-hidden="true" />
            <Sparkles size={22} className="relative" />
          </button>
        </div>
      )}
      {mounted && <Panel cfg={cfg} open={open} initialQuery={query} onClose={() => setOpen(false)} />}
    </>
  );
}
