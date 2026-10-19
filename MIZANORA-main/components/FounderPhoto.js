'use client';
import { useState } from 'react';

// The founder's photo. Tries each link in turn (plain browser image, no referrer, so image hosts do not block it),
// and shows his initials if none of them loads, so the page never has a broken picture.
export default function FounderPhoto({ photos = [], initials = 'M', name = '' }) {
  const [i, setI] = useState(0);
  if (i >= photos.length) {
    return <div className="grid h-24 w-24 shrink-0 place-items-center rounded-3xl bg-white/15 font-display text-3xl font-extrabold tracking-wide ring-2 ring-white/25">{initials}</div>;
  }
  return (
    <div className="flex shrink-0 gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photos[i]} alt={`${name}, founder of Mizanora`} width="112" height="112" referrerPolicy="no-referrer" loading="eager" decoding="async" onError={() => setI(i + 1)} className="h-28 w-28 rounded-3xl object-cover ring-2 ring-white/40" />
    </div>
  );
}
