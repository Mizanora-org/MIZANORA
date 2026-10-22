'use client';
import { useEffect, useMemo, useState } from 'react';
import { Copy, MessageCircle, MoonStar, Clock3 } from 'lucide-react';
import HijriChip from './HijriChip';
import DailyAyah from './DailyAyah';
import Link from 'next/link';
import { ISLAMIC_ITEMS, KIND_COLOR, KIND_LABEL } from '@/lib/islamic';
import { REMINDERS } from '@/lib/reminders';
import { nextIslamicEvent } from '@/lib/hijri';

// ISLAMIC FEED for the home page: a swipeable row of ayat, ahadees, duas and aqwal (Arabic + Urdu meaning + reference),
// today's Islamic date, the next Islamic occasion and today's namaz times. The first card changes every day.
const TABS = [['all', 'Sab'], ['ayat', 'Ayat'], ['hadith', 'Hadees'], ['dua', 'Dua / Aqwal']];
const PRAYERS = [['Fajr', 'Fajr'], ['Dhuhr', 'Zuhr'], ['Asr', 'Asr'], ['Maghrib', 'Maghrib'], ['Isha', 'Isha']];

const to12 = (t) => { const m = String(t || '').match(/(\d{1,2}):(\d{2})/); if (!m) return ''; let h = Number(m[1]); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${m[2]} ${ap}`; };
const dayNo = () => Math.floor((Date.now() + 5 * 3600000) / 86400000); // day number in Pakistan time

export default function IslamicFeed({ extra = [], winter = false }) {
  const [tab, setTab] = useState('all');
  const [start, setStart] = useState(0);
  const [ev, setEv] = useState(null);
  const [times, setTimes] = useState(null);
  const [done, setDone] = useState('');

  const all = useMemo(() => {
    const seen = new Set();
    const base = [...extra, ...ISLAMIC_ITEMS, ...REMINDERS.map((r, i) => ({ id: `r${i}`, kind: 'ayat', ar: r.ar, ur: r.ur, ref: r.ref }))];
    const list = base.filter((x) => { const k = x.ar || x.ur; if (seen.has(k)) return false; seen.add(k); return true; });
    return winter ? [...list.filter((x) => x.winter), ...list.filter((x) => !x.winter)] : list;
  }, [extra, winter]);

  const shown = useMemo(() => {
    const f = all.filter((x) => (tab === 'all' ? true : tab === 'dua' ? x.kind === 'dua' || x.kind === 'qaul' : x.kind === tab));
    if (!f.length) return [];
    const k = (start + (tab === 'all' ? 0 : 3)) % f.length;
    return [...f.slice(k), ...f.slice(0, k)];
  }, [all, tab, start]);

  useEffect(() => { setStart(dayNo()); setEv(nextIslamicEvent()); }, []);

  // Namaz times of Kasur (Hanafi Asr, University of Islamic Sciences Karachi method), kept for the day in the browser.
  useEffect(() => {
    let live = true;
    const key = `mz_pt_${dayNo()}`;
    try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c) { setTimes(c); return undefined; } } catch (_) { /* no storage */ }
    fetch('https://api.aladhan.com/v1/timingsByCity?city=Kasur&country=Pakistan&method=1&school=1')
      .then((r) => r.json())
      .then((j) => {
        const t = j && j.data && j.data.timings;
        if (!t || !live) return;
        const o = Object.fromEntries(PRAYERS.map(([k]) => [k, to12(t[k])]));
        setTimes(o);
        try { localStorage.setItem(key, JSON.stringify(o)); } catch (_) { /* ignore */ }
      })
      .catch(() => { /* offline: the strip is simply hidden */ });
    return () => { live = false; };
  }, []);

  const text = (x) => `${x.ar ? `${x.ar}\n` : ''}${x.ur}\n(${x.ref})\n\nMizanora: Shop smart. Shop halal.`;
  async function copy(x) { try { await navigator.clipboard.writeText(text(x)); setDone(x.id); setTimeout(() => setDone(''), 1600); } catch (_) { /* blocked */ } }

  return (
    <section className="mx-auto max-w-7xl px-3 pt-8 sm:px-4" aria-labelledby="islamic-feed">
      <div className="overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-[#F4F8F1] via-white to-[#EAF4EE] p-4 shadow-[0_10px_40px_-22px_rgba(11,107,69,.55)] sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="islamic-feed" className="flex items-center gap-2 text-xl font-extrabold text-cream sm:text-2xl"><MoonStar className="text-gold" size={22} /> Islami Feed</h2>
          <HijriChip className="!text-cream [&>span]:!bg-gold/10 [&>span]:!text-gold" />
        </div>

        <DailyAyah />
        {(ev || times) && (
          <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            {ev && <p className="rounded-2xl bg-white/80 px-3 py-2 text-sm text-dim ring-1 ring-line"><b className="text-cream">{ev.ur}</b>: taqreeban <b className="text-gold">{ev.inDays === 0 ? 'aaj' : `${ev.inDays} din baad`}</b> <span className="text-xs text-faint">(chand nazar aane par tareekh ek din aage peeche ho sakti hai)</span></p>}
            {times && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-white/80 px-3 py-2 text-xs ring-1 ring-line" aria-label="Namaz timings">
                <Clock3 size={14} className="text-gold" />
                {PRAYERS.map(([k, label]) => <span key={k}><b className="text-cream">{label}</b> <span className="text-dim">{times[k]}</span></span>)}
              </p>
            )}
          </div>
        )}

        <div role="tablist" aria-label="Feed type" className="mb-3 flex gap-2 overflow-x-auto no-sb">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold transition ${tab === k ? 'bg-gold text-white' : 'bg-white text-dim ring-1 ring-line hover:bg-raised'}`}>{label}</button>
          ))}
        </div>

        <div className="no-sb -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
          {shown.slice(0, 14).map((x) => (
            <article key={x.id} className="flex w-[84vw] max-w-sm shrink-0 snap-start flex-col rounded-2xl border border-line bg-white p-4 sm:w-80">
              <span className={`mb-2 w-fit rounded-full px-2.5 py-0.5 text-[0.68rem] font-extrabold text-white ${KIND_COLOR[x.kind] || 'bg-emerald-600'}`}>{KIND_LABEL[x.kind] || 'Yaad-dehani'}</span>
              {x.ar && <p lang="ar" dir="rtl" className="font-arabic text-2xl leading-[2.1] text-cream">{x.ar}</p>}
              <p className="mt-2 flex-1 text-sm text-dim">{x.ur}</p>
              <p className="mt-2 text-xs font-semibold text-faint">{x.ref}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => copy(x)} className="btn-ghost !gap-1.5 !px-3 !py-1.5 text-xs"><Copy size={14} /> {done === x.id ? 'Copy ho gaya' : 'Copy'}</button>
                <a href={`https://wa.me/?text=${encodeURIComponent(text(x))}`} target="_blank" rel="noopener noreferrer" className="btn-ghost !gap-1.5 !px-3 !py-1.5 text-xs"><MessageCircle size={14} /> Share</a>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2"><Link href="/quran" className="btn-gold !px-4 !py-2 text-sm">Quran parhein aur sunein</Link><Link href="/islamic" className="btn-ghost !px-4 !py-2 text-sm">Sab Islami posts</Link></div>
        <p className="mt-2 text-[0.7rem] text-faint">Har text hawale ke saath hai. Tafseel aur masail ke liye apne mustanad aalim se zaroor rujoo karein. Namaz ke auqaat taqreeban hain: apni masjid ke waqt ko tarjeeh dein.</p>
      </div>
    </section>
  );
}
