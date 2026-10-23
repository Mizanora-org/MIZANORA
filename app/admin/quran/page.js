'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { BookOpen, Clock, MoonStar, Play, Plus, Trash2 } from 'lucide-react';
import { dbClient } from '@/lib/firebase-client';
import { revalidateSite } from '@/lib/admin-cache';
import { STATE_DOC, cleanState } from '@/lib/quranState';
import { ANIMATIONS, DISPLAYS, MODES, QURAN_DEFAULT, QURAN_DOC, RECITERS, STYLES, SURAHS, TRANSLATIONS, cleanQuran, describeWindows, quranStatus, surahInfo } from '@/lib/quran';

// Admin > Quran: everything about the Quran session of the shop in one place (see lib/quran.js for what the session is).
// Saved in Firestore siteMeta/quran (the same place the shop reads it from); the shop refreshes within seconds of pressing Save.
const Host = dynamic(() => import('@/components/QuranHost'), { ssr: false });
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const Switch = ({ label, hint, checked, onChange }) => (
  <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0B6B45]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span><b className="block text-cream">{label}</b>{hint && <small className="text-dim">{hint}</small>}</span>
  </label>
);
const Pick = ({ label, value, onChange, options }) => (
  <label className="block text-sm"><span className="label">{label}</span>
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
  </label>
);

export default function AdminQuran() {
  const [cfg, setCfg] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState(false);
  const [tick, setTick] = useState(0);
  const [pos, setPos] = useState(undefined); // the live position: undefined = loading, null = none saved yet

  useEffect(() => {
    let live = true;
    getDoc(doc(dbClient(), QURAN_DOC.collection, QURAN_DOC.id)).then((d) => { if (live) setCfg(d.exists() ? cleanQuran({ ...QURAN_DEFAULT, ...d.data() }) : { ...QURAN_DEFAULT, mode: 'off' }); })
      .catch((e) => { if (live) { setMsg(`Could not read the setting: ${e.message}`); setCfg({ ...QURAN_DEFAULT, mode: 'off' }); } });
    getDoc(doc(dbClient(), STATE_DOC.collection, STATE_DOC.id)).then((d) => { if (live) setPos(d.exists() ? cleanState(d.data()) : null); }).catch(() => { if (live) setPos(null); });
    const t = setInterval(() => setTick((x) => x + 1), 20000);
    return () => { live = false; clearInterval(t); };
  }, []);

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const status = useMemo(() => (cfg ? quranStatus(cfg) : null), [cfg, tick]);
  if (!cfg) return <p className="p-6 text-dim">Loading...</p>;

  const max = surahInfo(cfg.surah).ayat;
  const setWin = (i, patch) => set('windows', cfg.windows.map((w, n) => (n === i ? { ...w, ...patch } : w)));
  const toggleDay = (i, d) => { const w = cfg.windows[i]; setWin(i, { days: w.days.includes(d) ? w.days.filter((x) => x !== d) : [...w.days, d].sort() }); };

  async function save(next = cfg, note = 'Saved. The shop shows it within a few seconds.') {
    setBusy(true); setMsg('');
    try {
      const clean = cleanQuran(next);
      await setDoc(doc(dbClient(), QURAN_DOC.collection, QURAN_DOC.id), { ...clean, updatedAtMs: Date.now() });
      setCfg(clean);
      await revalidateSite(undefined, ['quran']);
      setMsg(note);
    } catch (e) { setMsg(`Could not save: ${e.message}`); }
    setBusy(false);
  }
  const startNow = (min) => save({ ...cfg, mode: cfg.mode === 'off' ? 'schedule' : cfg.mode, liveUntil: Date.now() + min * 60000 }, `The Quran session is LIVE now for ${min} minutes.`);
  const stopNow = () => save({ ...cfg, liveUntil: 0 }, 'Manual session stopped. (A scheduled window, if one is running, continues. To switch everything off choose "Off".)');

  const shown = cleanQuran(cfg);
  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold"><MoonStar className="text-gold" /> Quran session</h1>
        <Link href="/quran" target="_blank" className="btn-ghost !px-4 !py-2 text-sm"><BookOpen size={16} /> Open /quran</Link>
      </div>
      {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm text-cream">{msg}</p>}

      <div className={`rounded-2xl p-4 text-white ${status && status.live ? 'bg-gradient-to-r from-[#0B6B45] to-[#0E8556]' : 'bg-[#46544C]'}`}>
        <p className="text-sm font-semibold uppercase tracking-wide">Right now</p>
        <p className="text-2xl font-extrabold">{status && status.live ? 'LIVE: visitors see the Quran session' : cfg.mode === 'off' ? 'Switched off' : 'Waiting for the next time window'}</p>
        <p className="mt-1 text-sm text-white/85">{cfg.mode === 'schedule' ? `Times (Pakistan time): ${describeWindows(shown.windows)}` : cfg.mode === 'always' ? 'It is always on.' : 'Nothing starts by itself.'}{status && status.live && status.endsAtMs ? ` Ends about ${new Date(status.endsAtMs).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' })}.` : ''}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[15, 30, 60, 120].map((m) => <button key={m} type="button" disabled={busy} onClick={() => startNow(m)} className="rounded-full bg-white px-4 py-2 text-sm font-extrabold text-[#0B6B45]">Start now: {m} min</button>)}
          <button type="button" disabled={busy} onClick={stopNow} className="rounded-full border border-white/70 px-4 py-2 text-sm font-bold text-white">Stop manual</button>
          <button type="button" onClick={() => setTest(true)} className="rounded-full border border-white/70 px-4 py-2 text-sm font-bold text-white"><Play size={14} className="mr-1 inline" /> Test on this screen</button>
        </div>
      </div>

      <section className="card space-y-3">
        <h2 className="text-lg font-extrabold">1. When</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map(([k, l]) => (
            <button key={k} type="button" onClick={() => set('mode', k)} className={`rounded-xl border-2 p-3 text-left text-sm font-bold ${cfg.mode === k ? 'border-gold bg-gold/5' : 'border-line'}`}>{l}</button>
          ))}
        </div>
        {cfg.mode === 'schedule' && (
          <div className="space-y-3">
            <p className="flex items-center gap-1.5 text-xs text-dim"><Clock size={14} /> Pakistan time. Example: shop opens at 09:00, Quran from 09:00 to 09:30. Leave the days empty for every day.</p>
            {cfg.windows.map((w, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3">
                <label className="text-sm">From <input type="time" className="input !w-auto" value={w.start} onChange={(e) => setWin(i, { start: e.target.value })} /></label>
                <label className="text-sm">To <input type="time" className="input !w-auto" value={w.end} onChange={(e) => setWin(i, { end: e.target.value })} /></label>
                <div className="flex flex-wrap gap-1">{DAYS.map((d, n) => <button key={d} type="button" onClick={() => toggleDay(i, n)} className={`rounded-full border px-2.5 py-1 text-xs font-bold ${w.days.includes(n) ? 'border-gold bg-gold text-white' : 'border-line text-dim'}`}>{d}</button>)}</div>
                <button type="button" onClick={() => set('windows', cfg.windows.filter((_, n) => n !== i))} className="ml-auto text-red-600" aria-label="Remove this time"><Trash2 size={18} /></button>
              </div>
            ))}
            {cfg.windows.length < 8 && <button type="button" className="btn-ghost !px-4 !py-2 text-sm" onClick={() => set('windows', [...cfg.windows, { start: '09:00', end: '09:30', days: [] }])}><Plus size={15} /> Add a time</button>}
          </div>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-extrabold">2. What is recited</h2>
        <div className="space-y-2 rounded-xl border border-line bg-surface p-3">
          <Pick label="Source" value={cfg.source} onChange={(v) => set('source', v)} options={[['ayah', 'Ayah by ayah, with the ayat and translation on the screen (recommended)'], ['stream', 'A ready-made live stream (paste its link)']]} />
          {cfg.source === 'stream' && (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2"><span className="label">Live stream link (https)</span><input className="input" value={cfg.streamUrl} onChange={(e) => set('streamUrl', e.target.value)} placeholder="https://www.youtube.com/watch?v=...  or  https://....mp3" /></label>
              <label className="block text-sm"><span className="label">Name shown to visitors</span><input className="input" maxLength={60} value={cfg.streamTitle} onChange={(e) => set('streamTitle', e.target.value)} placeholder="Makkah Live" /></label>
              <p className="text-xs text-dim">Works with a YouTube live / video link, a YouTube channel link (youtube.com/channel/UC...) or the address of a live audio stream (mp3 / aac). A stream has no ayah timing, so the ayat are not shown: only the voice or the video. If the link is wrong the visitor sees a short notice, nothing breaks.</p>
            </div>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Pick label="Surah" value={cfg.surah} onChange={(v) => setCfg((c) => cleanQuran({ ...c, surah: Number(v), from: 1, to: 0 }))} options={SURAHS.map((s) => [s.n, `${s.n}. ${s.name} (${s.ayat} ayat)`])} />
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm"><span className="label">From ayah</span><input type="number" min={1} max={max} className="input" value={cfg.from} onChange={(e) => set('from', Math.min(max, Math.max(1, Number(e.target.value) || 1)))} /></label>
            <label className="block text-sm"><span className="label">To ayah (0 = end)</span><input type="number" min={0} max={max} className="input" value={cfg.to} onChange={(e) => set('to', Math.min(max, Math.max(0, Number(e.target.value) || 0)))} /></label>
          </div>
          <Pick label="Reciter" value={cfg.reciter} onChange={(v) => set('reciter', v)} options={RECITERS} />
          <Pick label="Translation shown under the ayah" value={cfg.translation} onChange={(v) => set('translation', v)} options={TRANSLATIONS} />
        </div>
        <div className="space-y-2 rounded-xl border border-line bg-surface p-3 text-sm">
          <p><b className="text-cream">Live radio.</b> Visitors do not get play / pause / speed buttons. The recitation runs by itself in your time window, surah after surah (after 114 it starts again at 1). Where it stops when the window ends is remembered, and the next window goes on from exactly that place. The surah and ayah above are only the very first start (or after you press "Start over").</p>
          <p className="text-dim">Now: {pos === undefined ? 'checking...' : pos ? `Surah ${pos.surah} (${surahInfo(pos.surah).name}), ayah ${pos.ayah}` : 'no place saved yet (the first start is used)'}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost !px-4 !py-2 text-sm" disabled={busy} onClick={async () => { setBusy(true); try { await setDoc(doc(dbClient(), STATE_DOC.collection, STATE_DOC.id), { surah: cfg.surah, ayah: cfg.from, atMs: 0 }); setPos({ surah: cfg.surah, ayah: cfg.from, atMs: 0 }); setMsg('The live place is now the start above.'); } catch (e) { setMsg(`Could not change: ${e.message}`); } setBusy(false); }}>Start over from the surah / ayah above</button>
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-extrabold">3. How it looks and appears</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Pick label="How it appears to visitors" value={cfg.display} onChange={(v) => set('display', v)} options={DISPLAYS} />
          <Pick label="Colours" value={cfg.style} onChange={(v) => set('style', v)} options={STYLES} />
          <Pick label="Animation" value={cfg.animation} onChange={(v) => set('animation', v)} options={ANIMATIONS} />
          <Pick label="Size of the Arabic text" value={cfg.size} onChange={(v) => set('size', v)} options={[['s', 'Small'], ['m', 'Medium'], ['l', 'Large']]} />
          <label className="block text-sm"><span className="label">Title</span><input className="input" maxLength={60} value={cfg.title} onChange={(e) => set('title', e.target.value)} /></label>
          <label className="block text-sm"><span className="label">Short line on the button</span><input className="input" maxLength={140} value={cfg.message} onChange={(e) => set('message', e.target.value)} /></label>
          <label className="block text-sm"><span className="label">Volume: {cfg.volume}%</span><input type="range" min={0} max={100} className="w-full accent-[#0B6B45]" value={cfg.volume} onChange={(e) => set('volume', Number(e.target.value))} /></label>
          <Pick label="Show on" value={cfg.pages} onChange={(v) => set('pages', v)} options={[['all', 'Every page'], ['home', 'Home page only']]} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Switch label="Start the voice by itself" hint="Browsers need one touch first, then it starts." checked={cfg.autoStart} onChange={(v) => set('autoStart', v)} />
          <Switch label="Pause the shop music" hint="While the recitation plays." checked={cfg.pauseMusic} onChange={(v) => set('pauseMusic', v)} />
          <Switch label="Keep playing when the shop is closed" hint="Outside shop hours or after an emergency shut-down the live Quran continues on the closed screen." checked={cfg.closedPlay !== false} onChange={(v) => set('closedPlay', v)} />
          <Switch label="Show the Arabic text" checked={cfg.showArabic} onChange={(v) => set('showArabic', v)} />
          <Switch label="Visitors can choose translation, voice and text size" hint="A small settings button on the screen. Kept on the visitor's own device." checked={cfg.allowChoice} onChange={(v) => set('allowChoice', v)} />
        </div>
      </section>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur">
        <button type="button" className="btn-gold" disabled={busy} onClick={() => save()}>{busy ? 'Saving...' : 'Save'}</button>
        <button type="button" className="btn-ghost" onClick={() => setTest(true)}><Play size={15} /> Test</button>
        <span className="text-xs text-dim">The shop never plays sound without a touch from the visitor (browser rule). Without internet the session simply does not start.</span>
      </div>

      {test && <Host cfg={shown} autoStart radio={false} onClose={() => setTest(false)} />}
    </div>
  );
}
