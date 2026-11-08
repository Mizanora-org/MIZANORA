'use client';
import { useEffect, useState } from 'react';
import { proxyImage } from '@/lib/imgFallback';
import { W, photoSrcSet, photoUrl } from '@/lib/photo';

// The photo of a product card. If the image cannot load in THIS visitor's browser, the whole card is marked dead and
// removed with CSS (see [data-card][data-dead] in globals.css) - a product with a broken photo never shows on the shop.
// No empty grey box, no "unavailable" card: the grid simply reflows.
// v60: the photo is served resized + WebP from our own domain; the vendor link and the relay stay as fallbacks.
export default function CardPhoto({ src, alt, priority = false, sizes, width = W.card2x }) {
  const [step, setStep] = useState(0); // 0 = resized photo, 1 = vendor link, 2 = shop relay
  useEffect(() => { setStep(0); }, [src]);

  const dead = (e) => {
    try {
      const card = e.currentTarget.closest('[data-card]');
      if (card) card.setAttribute('data-dead', '1');
    } catch { /* ignore */ }
  };
  if (step > 0) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={step === 1 ? src : proxyImage(src)} alt={alt} referrerPolicy="no-referrer" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={(e) => (step === 1 ? setStep(2) : dead(e))} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={photoUrl(src, width)}
      srcSet={photoSrcSet(src, width)}
      alt={alt}
      sizes={sizes}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      referrerPolicy="no-referrer"
      className="absolute inset-0 h-full w-full object-cover"
      onError={() => setStep(1)}
    />
  );
}
