'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Headphones } from 'lucide-react';
import { SURAHS, TOTAL_AYAT, slugOfSurah } from '@/lib/quran';

// "Aaj ki Ayat": a different ayah of the Quran every day (day number mod 6236), with Urdu translation, taken from AlQuran Cloud so that no
// word of the Quran is typed by hand. Kept in the browser for the day. If the service cannot be reached nothing is shown (no wrong text).
const dayNo = () => Math.floor((Date.now() + 5 * 3600000) / 86400000);

export default function DailyAyah() {
  const [a, setA] = useState(null);
  useEffect(() => {
    let live = true;
    const d = dayNo();
    const key = `mz_daily_ayah_${d}`;
    try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c) { setA(c); return undefined; } } catch (_) { /* no storage */ }
    const n = (d * 37) % TOTAL_AYAT + 1; // a spread-out walk through the whole Quran
    fetch(`https://api.alquran.cloud/v1/ayah/${n}/editions/quran-uthmani,ur.jalandhry`)
      .then((r) => r.json())
      .then((j) => {
        const [ar, ur] = (j && j.data) || [];
        if (!ar || !ar.text || !live) return;
        const o = { ar: ar.text, ur: ur ? ur.text : '', s: ar.surah.number, n: ar.numberInSurah };
        setA(o);
        try { localStorage.setItem(key, JSON.stringify(o)); } catch (_) { /* ignore */ }
      }).catch(() => { /* stay hidden */ });
    return () => { live = false; };
  }, []);
  if (!a) return null;
  const s = SURAHS[a.s - 1];
  return (
    <div className="mb-4 rounded-2xl bg-gradient-to-br from-[#0B6B45] to-[#073D28] p-4 text-white sm:p-5">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[#F2C766]"><BookOpen size={14} /> Aaj ki Ayat</p>
      <p lang="ar" dir="rtl" className="font-arabic text-2xl leading-[2.2] sm:text-3xl">{a.ar}</p>
      {a.ur && <p lang="ur" dir="rtl" className="mt-2 text-base leading-8 text-white/90">{a.ur}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-white/80">Surah {s.name} {a.s}:{a.n}</p>
        <Link href={`/quran/${slugOfSurah(a.s)}#ayah-${a.n}`} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold hover:bg-white/25"><Headphones size={14} /> Sunein aur parhein</Link>
      </div>
    </div>
  );
}
