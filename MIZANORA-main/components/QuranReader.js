'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import QuranStage, { useQuran } from './QuranStage';
import { SURAHS, slugOfSurah } from '@/lib/quran';

// The reader page of one surah (/quran/<n>). The text is rendered on the server too (so Google can read every ayah);
// the player on top plays the recitation and lights up the ayah that is being recited. Tapping an ayah number plays from there.
export default function QuranReader({ data, cfg }) {
  const player = useQuran({ surah: data.surah, from: 1, to: 0, reciter: cfg.reciter, translation: cfg.translation, volume: cfg.volume, continuous: false, loop: false, initial: data });
  const [style, setStyle] = useState(cfg.style);
  const n = data.surah;
  const prevS = n > 1 ? SURAHS[n - 2] : null;
  const nextS = n < 114 ? SURAHS[n] : null;
  const cur = player.ayah ? player.ayah.n : 0;
  const rows = useMemo(() => data.ayahs, [data]);
  return (
    <div>
      <QuranStage player={player} style={style} animation={cfg.animation} size={cfg.size} showArabic showTranslation={Boolean(cfg.translation)} variant="page" title="Quran with recitation" />
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-faint">Look:</span>
        {[['emerald', 'Green'], ['night', 'Night'], ['gold', 'Cream']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setStyle(k)} className={`rounded-full border px-3 py-1 text-xs font-bold ${style === k ? 'border-gold bg-gold text-white' : 'border-line bg-surface text-dim'}`}>{l}</button>
        ))}
        <span className="ml-auto flex gap-2">
          {prevS && <Link href={`/quran/${slugOfSurah(prevS.n)}`} className="btn-ghost !px-3 !py-1.5 text-xs"><ChevronLeft size={14} /> {prevS.name}</Link>}
          {nextS && <Link href={`/quran/${slugOfSurah(nextS.n)}`} className="btn-ghost !px-3 !py-1.5 text-xs">{nextS.name} <ChevronRight size={14} /></Link>}
        </span>
      </div>

      <section className="mt-8" aria-label={`All ayat of Surah ${data.name}`}>
        <h2 className="section-title mb-2">Surah {data.name}: all {rows.length} ayat</h2>
        <ol className="mzq-list">
          {rows.map((a, idx) => (
            <li key={a.n} id={`ayah-${a.n}`} className="mzq-row" data-on={cur === a.n ? '1' : '0'}>
              <button type="button" className="num" onClick={() => player.goTo(idx, true)} aria-label={`Play ayah ${a.n}`}>{a.n}</button>
              <div>
                {a.bism && idx === 0 && <p lang="ar" dir="rtl" className="ar !text-[1.25rem] text-gold">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</p>}
                <p lang="ar" dir="rtl" className="ar">{a.ar}</p>
                {a.tr && <p className="tr" lang={/[؀-ۿ]/.test(a.tr) ? 'ur' : 'en'} dir={/[؀-ۿ]/.test(a.tr) ? 'rtl' : 'ltr'}>{a.tr}</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
