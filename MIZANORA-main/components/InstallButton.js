'use client';
import { Download, Share } from 'lucide-react';
import { useInstall } from './InstallProvider';

// Inline install call-to-action (thank-you page, header, product page...). Renders nothing if already installed.
export default function InstallButton({ className = '', full = false }) {
  const { canInstall, isIOS, promptInstall } = useInstall();
  if (canInstall) {
    return (
      <button onClick={promptInstall} className={`btn-gold ${full ? 'w-full' : ''} ${className}`}>
        <Download size={18} /> Install app
      </button>
    );
  }
  if (isIOS) {
    return (
      <p className={`flex items-center gap-2 rounded-xl bg-raised p-3 text-sm text-dim ${className}`}>
        <Share size={18} className="shrink-0 text-gold" />
        <span>To install: tap <b className="text-cream">Share</b>, then <b className="text-cream">Add to Home Screen</b>.</span>
      </p>
    );
  }
  return null;
}
