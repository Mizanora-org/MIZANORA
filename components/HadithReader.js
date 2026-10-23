'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BOOKS, LANGS, filterHadiths } from '@/lib/hadith';
import { Volume2, Square, Copy, Sparkles } from 'lucide-react';

// The hadith reader (v24): pick a book, a chapter group and a language, look a hadith up by its number, search inside the chapter,
// listen to it (the phone's own voice) and ask Noor about it. The text comes from /api/hadith, never from memory.
const VOICE = { urd: 'ur-PK', eng: 'en-US', ara: 'ar-SA' };

export default function HadithReader() {
  const [book, setBook] = useState('bukhari');
  const [lang, setLang] = useState('urd');
  const [section, setSection] = useState(1);
  const [sections, setSections] = useState([]);
  const [list, setList] = useState([]);
  const [title, setTitle] = useState('');
  const [state, setState] = useState('loading'); // loading | ready | error
  const [note, setNote] = useState('');
  const [q, setQ] = useState('');
  const [num, setNum] = useState('');
  const [speaking, setSpeaking] = useState(0);
  const [shown, setShown] = useState(20);
  const seq = useRef(0);

  const load = useCallback(async (b, l, s, n) => {
    const id = ++seq.current;
    setState('loading'); setNote('');
    const ask = async (lg) => {
      const qs = n ? `book=${b}&lang=${lg}&n=${n}` : `book=${b}&lang=${lg}&section=${s}`;
      const r = await fetch(`/api/hadith?${qs}`);
      return { r, j: await r.json().catch(() => ({})) };
    };
    try {
      let { r, j } = await ask(l);
      let used = l;
      if ((!r.ok || !j.ok) && l !== 'eng') { const x = await ask('eng'); if (x.r.ok && x.j.ok) { r = x.r; j = x.j; used = 'eng'; setNote(`${LANGS.find((z) => z[0] === l)[1]} translation is not available for this book, so English is shown.`); } }
      if (id !== seq.current) return;
      if (!r.ok || !j.ok) { setState('error'); setNote(j.error || 'Hadith load nahi ho saki. Thori dair baad koshish karein.'); return; }
      setList(j.hadiths || []); setTitle(n ? `Hadith ${n}` : j.title || ''); if (j.sections && j.sections.length) setSections(j.sections);
      setShown(20); setState('ready');
      if (used !== l) setLang(used);
    } catch (e) { if (id === seq.current) { setState('error'); setNote('Internet ka masla: hadith load nahi hui.'); } }
  }, []);

  useEffect(() => { load(book, lang, section, 0); return () => { try { window.speechSynthesis.cancel(); } catch (_) { /* no voice */ } }; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [book, lang, section]);

  const speak = (h) => {
    try {
      const ss = window.speechSynthesis;
      if (!ss) return;
      if (speaking === h.n) { ss.cancel(); setSpeaking(0); return; }
      ss.cancel();
      const u = new SpeechSynthesisUtterance(h.text.slice(0, 1800));
      u.lang = VOICE[lang] || 'en-US'; u.rate = 0.95;
      u.onend = () => setSpeaking(0); u.onerror = () => setSpeaking(0);
      setSpeaking(h.n); ss.speak(u);
    } catch (_) { setSpeaking(0); }
  };
  const copy = async (h) => {
    const b = BOOKS.find((x) => x.key === book);
    const t = `${h.text}\n\n(${b.name}, Hadith ${h.n})\nmizanora.vercel.app/hadith`;
    try { await navigator.clipboard.writeText(t); setNote('Copy ho gaya.'); } catch (_) { setNote('Copy nahi ho saka.'); }
  };
  const ask = (h) => {
    const b = BOOKS.find((x) => x.key === book);
    try { window.dispatchEvent(new CustomEvent('mz-assistant', { detail: { q: `${b.name} hadith ${h.n} ka matlab aur is ka darja (grade) batao` } })); } catch (_) { /* no assistant */ }
  };
  const view = useMemo(() => filterHadiths(list, q), [list, q]);
  const b = BOOKS.find((x) => x.key === book);

  return (
    <div className="space-y-4">
      <div className="card grid gap-3 sm:grid-cols-3">
        <label className="block text-sm"><span className="label">Kitab (book)</span>
          <select className="input" value={book} onChange={(e) => { setBook(e.target.value); setSection(1); setSections([]); setQ(''); }}>{BOOKS.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}</select></label>
        <label className="block text-sm"><span className="label">Zubaan (language)</span>
          <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>{LANGS.map((x) => <option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></label>
        <label className="block text-sm"><span className="label">Baab / hissa (chapter)</span>
          <select className="input" value={section} onChange={(e) => { setSection(Number(e.target.value)); setQ(''); }}>
            {(sections.length ? sections : [{ n: section, name: `Section ${section}` }]).map((x) => <option key={x.n} value={x.n}>{x.n}. {x.name}</option>)}
          </select></label>
      </div>
      <div className="card flex flex-wrap items-end gap-3">
        <label className="block min-w-[9rem] flex-1 text-sm"><span className="label">Is baab mein talash</span><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="lafz likhein (jaise: niyyat)" /></label>
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); const n = Math.floor(Number(num)); if (n >= 1) load(book, lang, section, n); }}>
          <label className="block text-sm"><span className="label">Hadith number</span><input className="input w-28" inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="jaise 1" /></label>
          <button className="btn-gold" type="submit">Kholein</button>
        </form>
      </div>

      <h2 className="font-display text-xl font-extrabold">{b.name} <span className="font-arabic text-gold" lang="ar" dir="rtl">{b.ar}</span>{title ? <span className="block text-sm font-semibold text-dim">{title}</span> : null}</h2>
      {note && <p role="status" className="rounded-xl bg-raised p-3 text-sm font-semibold text-gold">{note}</p>}
      {state === 'loading' && <p className="text-dim">Hadith load ho rahi hai...</p>}
      {state === 'error' && <button type="button" className="btn-ghost" onClick={() => load(book, lang, section, 0)}>Dobara koshish karein</button>}
      {state === 'ready' && !view.length && <p className="text-dim">Is baab mein koi hadith nahi mili.</p>}
      <ol className="space-y-3">
        {view.slice(0, shown).map((h) => (
          <li key={`${h.n}-${h.hadith}`} className="card">
            <p className="text-xs font-bold text-dim">{b.name} · Hadith {h.n}</p>
            <p className={`mt-2 whitespace-pre-line leading-loose ${lang === 'ara' ? 'font-arabic text-2xl' : lang === 'urd' ? 'text-lg' : ''}`} dir={lang === 'eng' ? 'ltr' : 'rtl'} lang={lang === 'urd' ? 'ur' : lang === 'ara' ? 'ar' : 'en'}>{h.text}</p>
            {h.grades && h.grades.length > 0 && <p className="mt-2 text-xs text-dim">Darja: {h.grades.map((g) => `${g.grade}${g.by ? ` (${g.by})` : ''}`).join(' · ')}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <button type="button" className="btn-ghost inline-flex items-center gap-1" onClick={() => speak(h)}>{speaking === h.n ? <Square size={14} /> : <Volume2 size={14} />}{speaking === h.n ? 'Rokein' : 'Sunein'}</button>
              <button type="button" className="btn-ghost inline-flex items-center gap-1" onClick={() => copy(h)}><Copy size={14} /> Copy</button>
              <button type="button" className="btn-ghost inline-flex items-center gap-1" onClick={() => ask(h)}><Sparkles size={14} /> Noor se poochein</button>
            </div>
          </li>
        ))}
      </ol>
      {view.length > shown && <button type="button" className="btn-ghost" onClick={() => setShown((n) => n + 30)}>Aur dikhayein ({view.length - shown})</button>}
      <p className="text-xs text-dim">Hadith ka text khula hadith data (hadith-api) se aata hai, kuch bhi haath se nahi likha gaya. Darja (grade) wahi dikhaya jata hai jo data mein diya gaya hai. Fiqhi masail ke liye kisi mustanad aalim se poochein.</p>
    </div>
  );
}
