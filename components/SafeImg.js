'use client';
import { useEffect, useState } from 'react';
import { imgFallback, markBrokenHost, proxyImage, shouldRelay } from '@/lib/imgFallback';

// A plain image that removes itself (or its closest [data-dead-wrap]) when the link is broken.
// Used for the smaller pictures: category circles, banners, reels - so a dead link never leaves an empty frame.
// v32: a picture the browser refuses gets ONE more try through the shop's image relay (/api/img) before it is hidden.
export default function SafeImg({ src, alt = '', className = '', wrap = false, ...rest }) {
  // v60: a host that already failed (or a declared bad host) starts at the relay.
  const [step, setStep] = useState(() => (shouldRelay(src) ? 1 : 0)); // 0 = original link, 1 = shop relay
  useEffect(() => { setStep(shouldRelay(src) ? 1 : 0); }, [src]);
  if (!src) return null;
  const onError = (e) => {
    if (step === 0) { markBrokenHost(src); setStep(1); return; }
    imgFallback(e, { wrap });
  };
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={step === 0 ? src : proxyImage(src)} alt={alt} className={className} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={onError} {...rest} />;
}
