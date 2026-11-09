'use client';
import { useEffect, useState } from 'react';
import { markBrokenHost, proxyImage, shouldRelay } from '@/lib/imgFallback';

// Mizanora v56 — a person's photo that always shows *something*.
//
// Star portraits come from a few different CDNs (IMDb's public portrait lookup, TMDB, the shop's own
// uploads). Any of them can block a hotlink, expire, or 404 — and when that happened the card showed
// a broken-image icon. The order is now:
//
//   1. the original URL (no Referer sent, which alone fixes most hotlink blocks),
//   2. the shop's relay `/api/img` (server-side fetch, so the CDN cannot see the visitor),
//   3. a coloured monogram — never an empty circle.
export default function AvatarImg({
  src,
  name = '',
  className = '',
  hue = 152,
  initials = '',
  alt,
}) {
  // v60: a host that already failed (or a declared bad host) starts at the relay - see lib/imgFallback.js.
  const [step, setStep] = useState(() => (shouldRelay(src) ? 1 : 0)); // 0 original · 1 relay · 2 monogram
  useEffect(() => { setStep(shouldRelay(src) ? 1 : 0); }, [src]);

  const label = (initials || name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '★';

  if (!src || step >= 2) {
    return (
      <span
        aria-hidden="true"
        className={`grid place-items-center font-display font-extrabold text-white ${className}`}
        style={{ background: `linear-gradient(145deg, hsl(${hue}, 55%, 32%), hsl(${(hue + 40) % 360}, 60%, 15%))` }}
      >
        {label}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={step === 0 ? src : proxyImage(src)}
      alt={alt || name || 'Portrait'}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => { if (step === 0) markBrokenHost(src); setStep((s) => s + 1); }}
    />
  );
}
