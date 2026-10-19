'use client';
import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { hijriNow, isFridayKarachi } from '@/lib/hijri';

// Today's Islamic date (and a Jumu'ah greeting on Fridays). Calculated in the visitor's browser so it is always today's date.
export default function HijriChip({ className = '' }) {
  const [h, setH] = useState(null);
  const [fri, setFri] = useState(false);
  useEffect(() => { setH(hijriNow()); setFri(isFridayKarachi()); }, []);
  if (!h) return <span className={`block h-5 ${className}`} />;
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-0.5 text-[0.7rem] font-bold"><CalendarDays size={14} /> {h.text}<span className="font-arabic text-sm font-normal text-saffron">{h.ar}</span></span>
      {fri && <span className="rounded-full bg-saffron px-2.5 py-0.5 text-[0.7rem] font-extrabold text-[#2B1B00]">Jumu&apos;ah Mubarak</span>}
    </span>
  );
}
