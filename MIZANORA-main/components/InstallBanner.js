'use client';
import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useInstall } from './InstallProvider';

// Bottom banner shown a few seconds after the visitor starts browsing.
// Browsers do not allow forcing an install, so we ask politely, at a good moment, and re-ask after 3 days.
export default function InstallBanner() {
  const { canInstall, isIOS, snoozed, promptInstall, dismiss } = useInstall();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 7000);
    return () => clearTimeout(t);
  }, []);

  if (!show || snoozed || !(canInstall || isIOS)) return null;

  return (
    <div role="dialog" aria-label="Install Mizanora app" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-bronze bg-surface p-4 shadow-2xl">
      <button onClick={dismiss} aria-label="Close" className="absolute right-2 top-2 rounded-full p-2 text-faint hover:text-cream"><X size={18} /></button>
      <div className="flex items-start gap-3 pr-6">
        <img src="/icons/icon-192.png" alt="" width="44" height="44" className="rounded-xl" />
        <div>
          <p className="font-semibold text-cream">Install the Mizanora app</p>
          <p className="mt-0.5 text-sm text-dim">Faster ordering, works on weak internet, and your next order is one tap away.</p>
        </div>
      </div>
      {canInstall ? (
        <button onClick={promptInstall} className="btn-gold mt-3 w-full"><Download size={18} /> Install app (free)</button>
      ) : (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-raised p-3 text-sm text-dim">
          <Share size={18} className="shrink-0 text-gold" />
          <span>Tap <b className="text-cream">Share</b>, then <b className="text-cream">Add to Home Screen</b>.</span>
        </p>
      )}
    </div>
  );
}
