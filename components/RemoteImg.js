'use client';
import { useEffect, useState } from 'react';
import { proxyImage } from '@/lib/imgFallback';
import { W, photoSrcSet, photoUrl } from '@/lib/photo';

// ONE REMOTE PHOTO, FOUR CHANCES (v32, rebuilt in v60 on the resizer):
//   1. the picture resized + WebP from our own domain (/api/photo) — small, fast, cached for a year,
//   2. the browser loading the original directly with no referrer (most hotlink blocks solved),
//   3. the shop's own relay /api/img (host blocks hotlinking, expired link, http link),
// and only then it disappears (or calls onDead) instead of showing a broken icon.
// Use it anywhere a product/photo link must never leave an empty frame.
export default function RemoteImg({ src, alt = '', className = '', fill = false, sizes, priority = false, width = W.card2x, height, onDead, ...rest }) {
  const [step, setStep] = useState(0);
  useEffect(() => { setStep(0); }, [src]);
  useEffect(() => { if (step >= 3 && typeof onDead === 'function') onDead(); }, [step, onDead]);

  if (!src || step >= 3) return null;

  const fail = () => setStep((s) => s + 1);
  const box = fill
    ? { className, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } }
    : { className, width: width || 96, height: height || 96 };

  if (step === 0) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        {...rest}
        {...box}
        src={photoUrl(src, width)}
        srcSet={photoSrcSet(src, width)}
        sizes={sizes}
        alt={alt}
        referrerPolicy="no-referrer"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        onError={fail}
      />
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      {...rest}
      {...box}
      src={step === 1 ? src : proxyImage(src)}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={fail}
    />
  );
}
