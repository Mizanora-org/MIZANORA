'use client';
import { useState } from 'react';
import { Download, Share2, Smartphone, X } from 'lucide-react';
import { useInstall } from './InstallProvider';

// One clear "Install app" entry (footer + account page). Browsers decide when they offer the real install prompt,
// so this button explains the two-tap path on iPhone when the automatic prompt is not available.
export default function InstallApp({ variant = 'link' }) {
  const { canInstall, isIOS, installed, promptInstall } = useInstall();
  const [ios, setIos] = useState(false);
  if (installed) return <span className={variant === 'button' ? 'btn-ghost !py-2.5 opacity-60' : 'text-faint'}><Smartphone size={15} className="mr-1 inline" /> App installed</span>;

  if (canInstall) {
    return (
      <button type="button" onClick={() => promptInstall()} className={variant === 'button' ? 'btn-gold !py-2.5' : 'flex items-center gap-1.5 font-semibold text-gold'}>
        <Download size={15} /> Install the app (free)
      </button>
    );
  }
  if (isIOS) {
    return (
      <span className="relative inline-block">
        <button type="button" onClick={() => setIos((v) => !v)} className={variant === 'button' ? 'btn-gold !py-2.5' : 'flex items-center gap-1.5 font-semibold text-gold'}>
          <Download size={15} /> Install on iPhone
        </button>
        {ios && (
          <span className="absolute bottom-full left-0 z-40 mb-2 block w-64 rounded-xl border border-line bg-surface p-3 text-left text-xs text-dim shadow-xl">
            <button type="button" onClick={() => setIos(false)} aria-label="Close" className="absolute right-1 top-1 rounded-full p-1 text-faint"><X size={14} /></button>
            <b className="block text-cream">iPhone par install</b>
            <span className="mt-1 flex items-center gap-1.5"><Share2 size={13} className="text-gold" /> Safari me neeche wala <b>Share</b> button dabayein</span>
            <span className="mt-1 block">phir <b>Add to Home Screen</b> chunein. App icon ban jayega.</span>
          </span>
        )}
      </span>
    );
  }
  return <span className={variant === 'button' ? 'btn-ghost !py-2.5 opacity-70' : 'text-faint'}><Smartphone size={15} className="mr-1 inline" /> Browser menu → “Install app”</span>;
}
