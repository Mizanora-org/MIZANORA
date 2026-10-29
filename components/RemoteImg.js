'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { proxyImage } from '@/lib/imgFallback';

// ONE REMOTE PHOTO, THREE CHANCES (v32):
//   1. Next's image (or the plain original when the optimizer is off),
//   2. the browser loading it directly with no referrer (most hotlink blocks solved),
//   3. the shop's own relay /api/img (host blocks hotlinking, expired link, http link),
// and only then it disappears (or calls onDead) instead of showing a broken icon.
// Use it anywhere a product/photo link must never leave an empty frame.
export default function RemoteImg({ src, alt = '', className = '', fill = false, sizes, priority = false, width, height, onDead, ...rest }) {
  const [step, setStep] = useState(0);
  useEffect(() => { setStep(0); }, [src]);
  useEffect(() => { if (step >= 3 && typeof onDead === 'function') onDead(); }, [step, onDead]);

  if (!src || step >= 3) return null;

  const fail = () => setStep((s) => s + 1);

  if (step === 0) {
    const common = { src, alt, referrerPolicy: 'no-referrer', priority, sizes, onError: fail, ...rest };
    return fill
      ? <Image {...common} referrerPolicy="no-referrer" fill className={className} />
      : <Image {...common} referrerPolicy="no-referrer" width={width || 96} height={height || 96} className={className} />;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      {...rest}
      src={step === 1 ? src : proxyImage(src)}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={fail}
      className={className}
      style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } : undefined}
    />
  );
}
