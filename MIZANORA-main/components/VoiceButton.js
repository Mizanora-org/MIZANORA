'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';

// Voice search (free, built into Chrome / Android / Safari). Speak Urdu or English; hidden on browsers without support.
export default function VoiceButton({ onText, className = '' }) {
  const [ok, setOk] = useState(false);
  const [on, setOn] = useState(false);
  const [lang, setLang] = useState('ur-PK');
  const rec = useRef(null);
  useEffect(() => {
    setOk(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    try { const l = localStorage.getItem('mz_voice_lang'); if (l === 'en-PK' || l === 'ur-PK') setLang(l); } catch (_) {}
    return () => { try { if (rec.current) rec.current.abort(); } catch (_) {} };
  }, []);
  if (!ok) return null;

  const flip = () => { const n = lang === 'ur-PK' ? 'en-PK' : 'ur-PK'; setLang(n); try { localStorage.setItem('mz_voice_lang', n); } catch (_) {} };
  const listen = () => {
    if (on) { try { rec.current.stop(); } catch (_) {} return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = lang; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e) => { const t = e.results && e.results[0] && e.results[0][0] ? e.results[0][0].transcript : ''; if (t) onText(t); };
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r;
    try { r.start(); setOn(true); } catch (_) { setOn(false); }
  };

  return (
    <span className={`inline-flex shrink-0 items-center ${className}`}>
      <button type="button" onClick={flip} aria-label={`Voice language: ${lang === 'ur-PK' ? 'Urdu' : 'English'}. Tap to change`} className="px-1 text-[0.65rem] font-extrabold text-dim hover:text-gold">{lang === 'ur-PK' ? 'اردو' : 'EN'}</button>
      <button type="button" onClick={listen} aria-label={on ? 'Stop listening' : 'Search by voice'} aria-pressed={on} className={`grid h-9 w-9 place-items-center rounded-full ${on ? 'animate-pulse bg-red-600 text-white' : 'text-dim hover:text-gold'}`}><Mic size={18} /></button>
    </span>
  );
}
