'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Clock3, Copy, ExternalLink, Mic, Play, Plus, Radio, RefreshCw, Square, Trash2, Tv, Wand2, Youtube } from 'lucide-react';
import { authClient } from '@/lib/firebase-client';
import {
  CHANNEL_DEFAULT, MODES, THEMES, TTS_VOICES, YT_PRIVACY,
  adVoiceId, cleanChannel, hadithVoiceId, channelStatus, nowPlaying, pktClock,
} from '@/lib/liveChannel';
import { RECITERS, SURAHS, TRANSLATIONS, describeWindows } from '@/lib/quran';
import { BOOKS } from '@/lib/hadith';

// Admin > Live Channel: the control desk of the Quran & Hadith channel (see lib/liveChannel.js).
//  * On Air      - on/off, name, slogan, theme, ticker, the live status and the links (page + m3u8)
//  * Schedule    - the Pakistan-time windows and the cadence (tilawat / hadees / ad break)
//  * Quran & Hadith - start surah, reciter, translation, the books that rotate, AI voice of the readings
//  * Products & Ads - which products are advertised and their AI voiceovers (Gemini TTS)
//  * YouTube     - create a live broadcast with the YouTube API and get the RTMPS key for the cast action
// Everything is saved with the admin API (Firebase + revalidate), so the shop and the stream update within seconds.
const TABS = [['onair', 'On Air'], ['schedule', 'Schedule'], ['books', 'Quran & Hadith'], ['ads', 'Products & Ads'], ['youtube', 'YouTube']];
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
const Num = ({ label, value, onChange, min, max, hint }) => (
  <label className="block text-sm"><span className="label">{label}</span>
    <input type="number" className="input" min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)} />
    {hint && <small className="text-dim">{hint}</small>}
  </label>
);

export default function AdminLiveChannel() {
  const [cfg, setCfg] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [tab, setTab] = useState('onair');
  const [voices, setVoices] = useState([]);
  const [tick, setTick] = useState(0);
  const [pq, setPq] = useState('');
  const [hits, setHits] = useState([]);
  const [adScripts, setAdScripts] = useState({}); // slug -> custom voiceover script
  const [hadVoice, setHadVoice] = useState({ book: 'bukhari', section: 1 });
  const [yt, setYt] = useState({ configured: false, hint: '' });
  const [ytRes, setYtRes] = useState(null);
  const [live, setLive] = useState(30);

  const call = async (body) => {
    const token = await authClient().currentUser.getIdToken();
    const r = await fetch('/api/admin/live-channel', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    return r.json();
  };

  const load = async () => {
    try {
      const j = await call({ action: 'get' });
      if (!j.ok) throw new Error(j.error || 'Could not read the setting.');
      setCfg(cleanChannel(j.cfg));
      setVoices(j.voices || []);
      const s = await call({ action: 'ytStatus' });
      if (s.ok) setYt(s);
    } catch (e) {
      setMsg(e.message);
      setCfg(cleanChannel(CHANNEL_DEFAULT));
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 15000); return () => clearInterval(t); }, []);

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const setAds = (k, v) => setCfg((c) => ({ ...c, ads: { ...c.ads, [k]: v } }));
  const setHad = (k, v) => setCfg((c) => ({ ...c, hadith: { ...c.hadith, [k]: v } }));
  const setYtCfg = (k, v) => setCfg((c) => ({ ...c, youtube: { ...c.youtube, [k]: v } }));

  const shown = cfg ? cleanChannel(cfg) : null;
  const status = useMemo(() => (shown ? channelStatus(shown) : null), [shown, tick]);
  const playing = useMemo(() => (shown ? nowPlaying(shown) : null), [shown, tick]);

  if (!cfg) return <p className="p-6 text-dim">Loading...</p>;

  async function save(next = cfg, note = 'Saved. The channel and the stream update within seconds.') {
    setBusy('save'); setMsg('');
    try {
      const clean = cleanChannel(next);
      const j = await call({ action: 'save', cfg: clean });
      if (!j.ok) throw new Error(j.error || 'Could not save.');
      setCfg(clean);
      setMsg(note);
    } catch (e) { setMsg(`Could not save: ${e.message}`); }
    setBusy('');
  }

  const setWin = (i, patch) => set('windows', cfg.windows.map((w, n) => (n === i ? { ...w, ...patch } : w)));
  const toggleDay = (i, d) => { const w = cfg.windows[i]; setWin(i, { days: w.days.includes(d) ? w.days.filter((x) => x !== d) : [...w.days, d].sort() }); };

  const searchProducts = async () => {
    if (pq.trim().length < 2) return;
    setBusy('search');
    try { const r = await fetch(`/api/search?q=${encodeURIComponent(pq.trim())}`); const j = await r.json(); setHits((j.items || j.products || []).slice(0, 12)); } catch { setHits([]); }
    setBusy('');
  };
  const addAd = (slug) => {
    if (!slug || shown.ads.slugs.includes(slug)) return;
    setAds('slugs', [...shown.ads.slugs, slug].slice(0, 30));
  };

  async function genVoice(id, text, voiceName, kind) {
    if (!text || !text.trim()) { setMsg('Pehle script likhein (jo AI bolega).'); return; }
    setBusy(`voice:${id}`); setMsg('');
    try {
      const j = await call({ action: 'voice', id, text, voiceName, kind });
      if (!j.ok) throw new Error(j.error || 'Voiceover could not be made.');
      setVoices((v) => [...v.filter((x) => x !== id), id]);
      setMsg(`AI voiceover ready: ${id} (${Math.round(j.bytes / 1024)} KB). Channel ab isko live bajayega.`);
    } catch (e) { setMsg(e.message); }
    setBusy('');
  }
  async function delVoice(id) {
    setBusy(`voice:${id}`);
    try { await call({ action: 'voiceDelete', id }); setVoices((v) => v.filter((x) => x !== id)); setMsg('Voiceover deleted.'); } catch (e) { setMsg(e.message); }
    setBusy('');
  }

  async function ytCreate() {
    setBusy('yt'); setMsg(''); setYtRes(null);
    try {
      const j = await call({ action: 'ytCreate', title: cfg.youtube.title || cfg.title, privacy: cfg.youtube.privacy });
      if (!j.ok) throw new Error(j.error || 'YouTube broadcast could not be created.');
      setYtRes(j);
      setCfg((c) => ({ ...c, youtube: { ...c.youtube, last: { broadcastId: j.broadcastId, streamId: j.streamId, rtmpUrl: j.rtmpUrl, streamKey: j.streamKey, watchUrl: j.watchUrl, createdAt: j.createdAt } } }));
      setMsg('YouTube live broadcast ban gaya. Stream key neeche diya gaya hai.');
    } catch (e) { setMsg(e.message); }
    setBusy('');
  }
  async function ytEnd() {
    const id = (ytRes && ytRes.broadcastId) || (cfg.youtube.last && cfg.youtube.last.broadcastId);
    if (!id) { setMsg('Koi broadcast abhi chal nahi raha.'); return; }
    setBusy('yt');
    try { const j = await call({ action: 'ytEnd', broadcastId: id }); if (!j.ok) throw new Error(j.error); setMsg('YouTube broadcast complete kar diya gaya.'); } catch (e) { setMsg(e.message); }
    setBusy('');
  }

  const last = (ytRes || cfg.youtube.last) || null;
  const m3u8Url = typeof window !== 'undefined' ? `${window.location.origin}/api/live/channel.m3u8` : '/api/live/channel.m3u8';
  const castCmd = last
    ? `# 24/7 apne PC/VPS par (zero gap):\nnode scripts/live-cast.mjs --loop --base ${typeof window !== 'undefined' ? window.location.origin : 'https://mizanora.vercel.app'}\n# ya ek one-shot push (GitHub Action yehi karta hai):\nnode scripts/live-cast.mjs --minutes 330\n# YOUTUBE_STREAM_KEY=${last.streamKey ? last.streamKey.slice(0, 6) + '...' : '<GitHub secret>'}`
    : 'npm run cast:live -- --loop   # 24/7 (zero gap)';

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold"><Radio className="text-gold" /> Live Channel (Quran &amp; Hadith)</h1>
        <div className="flex gap-2">
          <Link href="/live-channel" target="_blank" className="btn-ghost !px-4 !py-2 text-sm"><ExternalLink size={15} /> Open channel</Link>
          <button type="button" onClick={() => save()} disabled={busy === 'save'} className="btn-gold !px-5 !py-2 text-sm">{busy === 'save' ? 'Saving...' : 'Save all'}</button>
        </div>
      </div>
      {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm text-cream">{msg}</p>}

      <div className={`rounded-2xl p-4 text-white ${status && status.onAir ? 'bg-gradient-to-r from-[#0B6B45] to-[#0E8556]' : 'bg-[#46544C]'}`}>
        <p className="text-sm font-semibold uppercase tracking-wide">Right now {pktClock().time} PKT</p>
        <p className="text-2xl font-extrabold">
          {status && status.onAir ? `ON AIR: ${playing && playing.seg ? playing.seg.kind.toUpperCase() : ''}` : shown.mode === 'off' ? 'Channel switched off' : 'Off air — waiting for the next window'}
        </p>
        <p className="mt-1 text-sm text-white/85">
          {shown.mode === 'schedule' ? `Times (Pakistan): ${describeWindows(shown.windows)}` : shown.mode === 'always' ? 'Always on air.' : 'Nothing starts by itself.'}
          {playing && playing.seg ? ` · Now: ${playing.seg.kind === 'quran' ? `Surah ${playing.seg.surahName}` : playing.seg.kind === 'hadith' ? `${playing.seg.book} #${playing.seg.section}` : playing.seg.slug}` : ''}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-gold text-white' : 'border border-line bg-surface text-dim'}`}>{l}</button>
        ))}
      </div>

      {tab === 'onair' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card space-y-4">
            <Pick label="Channel mode" value={shown.mode} onChange={(v) => set('mode', v)} options={MODES} />
            <label className="block text-sm"><span className="label">Channel title</span>
              <input className="input" value={cfg.title} onChange={(e) => set('title', e.target.value)} maxLength={60} /></label>
            <label className="block text-sm"><span className="label">Slogan (under the title on the gate screen)</span>
              <input className="input" value={cfg.slogan} onChange={(e) => set('slogan', e.target.value)} maxLength={120} /></label>
            <Pick label="Theme" value={shown.theme} onChange={(v) => set('theme', v)} options={THEMES} />
            <Switch label="Pakistan clock on screen" hint="The ticking PKT clock + Hijri date in the top bar" checked={shown.showClock} onChange={(v) => set('showClock', v)} />
            <label className="block text-sm"><span className="label">Ticker lines ( | se alag karein — khaali = default lines)</span>
              <textarea className="input min-h-[80px]" value={cfg.ticker} onChange={(e) => set('ticker', e.target.value)} maxLength={600} /></label>
          </div>
          <div className="card space-y-4">
            <h2 className="section-title !text-xl">Go live now</h2>
            <p className="text-sm text-dim">Schedule ke baghair bhi channel foran on kar sakte hain (maslan khaas mauqa par).</p>
            <div className="flex items-center gap-2">
              <input type="number" className="input !w-28" min={5} max={720} value={live} onChange={(e) => setLive(e.target.value)} />
              <button type="button" className="btn-gold !px-4 !py-2 text-sm" disabled={busy === 'save'} onClick={() => save({ ...cfg, mode: cfg.mode === 'off' ? 'schedule' : cfg.mode, liveUntil: Date.now() + Number(live || 30) * 60000 }, `Channel is LIVE for ${live} minutes.`)}>
                <Play size={15} /> Live for {live} min
              </button>
              <button type="button" className="btn-ghost !px-4 !py-2 text-sm" disabled={busy === 'save'} onClick={() => save({ ...cfg, liveUntil: 0 }, 'Manual live session stopped.')}>
                <Square size={15} /> Stop
              </button>
            </div>
            <h2 className="section-title !text-xl pt-2">Links</h2>
            <p className="text-sm text-dim">Channel page: <a className="font-semibold text-gold underline" href="/live-channel" target="_blank" rel="noreferrer">/live-channel</a></p>
            <p className="text-sm text-dim break-all">Live M3U8 stream: <span className="font-mono text-xs text-cream">{m3u8Url}</span> — VLC / koi bhi HLS player isko chala sakta hai.</p>
            <button type="button" className="btn-ghost !px-4 !py-2 text-sm" onClick={() => { navigator.clipboard.writeText(m3u8Url); setMsg('M3U8 link copy ho gaya.'); }}>
              <RefreshCw size={15} /> Copy m3u8 link
            </button>
          </div>
        </div>
      )}

      {tab === 'schedule' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card space-y-3">
            <h2 className="section-title !text-xl">On-air windows (Pakistan time)</h2>
            {cfg.windows.map((w, i) => (
              <div key={i} className="rounded-xl border border-line bg-raised p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input type="time" className="input !w-36" value={w.start} onChange={(e) => setWin(i, { start: e.target.value })} />
                  <span className="text-dim">to</span>
                  <input type="time" className="input !w-36" value={w.end} onChange={(e) => setWin(i, { end: e.target.value })} />
                  <button type="button" className="ml-auto text-red-600" onClick={() => set('windows', cfg.windows.filter((_, n) => n !== i))} aria-label="Remove window"><Trash2 size={17} /></button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DAYS.map((d, n) => (
                    <button key={d} type="button" onClick={() => toggleDay(i, n)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${w.days.includes(n) ? 'bg-gold text-white' : 'border border-line bg-surface text-dim'}`}>{d}</button>
                  ))}
                  <small className="self-center text-dim">{w.days.length ? '' : 'Har roz'}</small>
                </div>
              </div>
            ))}
            <button type="button" className="btn-ghost !px-4 !py-2 text-sm" onClick={() => set('windows', [...cfg.windows, { start: '20:00', end: '22:00', days: [] }].slice(0, 8))}>
              <Plus size={15} /> Add window
            </button>
          </div>
          <div className="card space-y-4">
            <h2 className="section-title !text-xl">Program ka tareeqa-kar</h2>
            <p className="text-sm text-dim">Har cycle mein: <b>Quran tilawat</b> → <b>Hadith</b> → <b>Ad break</b>, phir dobara. Cycle number se hi sab tay hota hai, is liye har visitor ko ek hi waqt ek hi cheez sunayi deti hai.</p>
            <Num label="Quran tilawat (minutes per block)" value={cfg.quranMin} min={1} max={120} onChange={(v) => set('quranMin', v)} />
            <Num label="Hadith reading (minutes per block — 0 = band)" value={cfg.hadithMin} min={0} max={60} onChange={(v) => set('hadithMin', v)} />
            <Num label="Ad break (seconds)" value={cfg.ads.seconds} min={10} max={120} onChange={(v) => setAds('seconds', v)} />
          </div>
        </div>
      )}

      {tab === 'books' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card space-y-4">
            <h2 className="section-title !text-xl">Quran tilawat</h2>
            <label className="block text-sm"><span className="label">Start surah (rotation yahin se shuru hoti hai, phir poori Quran ghoomti hai)</span>
              <select className="input" value={cfg.startSurah} onChange={(e) => set('startSurah', e.target.value)}>
                {SURAHS.map((s) => <option key={s.n} value={s.n}>{s.n}. {s.name} ({s.ayat} ayat)</option>)}
              </select></label>
            <Pick label="Reciter" value={cfg.reciter} onChange={(v) => set('reciter', v)} options={RECITERS.map(([k, l]) => [k, l])} />
            <Pick label="Translation (screen par dikhti hai)" value={cfg.translation} onChange={(v) => set('translation', v)} options={TRANSLATIONS.map(([k, l]) => [k || '', l])} />
          </div>
          <div className="card space-y-4">
            <h2 className="section-title !text-xl">Hadith books (rotation)</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {BOOKS.map((b) => (
                <Switch key={b.key} label={b.name} hint={b.ar} checked={shown.hadith.books.includes(b.key)}
                  onChange={(v) => setHad('books', v ? [...shown.hadith.books, b.key].slice(0, 9) : shown.hadith.books.filter((x) => x !== b.key))} />
              ))}
            </div>
            <Pick label="Hadith language" value={cfg.hadith.lang} onChange={(v) => setHad('lang', v)} options={[['urd', 'Urdu'], ['eng', 'English'], ['ara', 'Arabic']]} />
            <Pick label="AI voice of the hadith reading" value={cfg.hadith.voiceName} onChange={(v) => setHad('voiceName', v)} options={TTS_VOICES.map((v) => [v, v])} />
            <div className="rounded-xl border border-line bg-raised p-3 text-sm">
              <b className="block text-cream">Hadith ki AI voiceover banayein</b>
              <p className="text-dim">Book + section chunein aur button dabayein — channel usi section ki awaaz live bajayega.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select className="input !w-52" value={hadVoice.book} onChange={(e) => setHadVoice((h) => ({ ...h, book: e.target.value }))}>
                  {BOOKS.map((b) => <option key={b.key} value={b.key}>{b.name}</option>)}
                </select>
                <input type="number" className="input !w-24" min={1} max={99} value={hadVoice.section} onChange={(e) => setHadVoice((h) => ({ ...h, section: e.target.value }))} />
                <button type="button" className="btn-gold !px-4 !py-2 text-sm" disabled={busy.startsWith('voice:')}
                  onClick={() => genVoice(hadithVoiceId(hadVoice.book, Number(hadVoice.section) || 1, cfg.hadith.lang), `Hadees: ${BOOKS.find((b) => b.key === hadVoice.book)?.name || ''}, riwayat number ${hadVoice.section}.`, cfg.hadith.voiceName, 'hadith')}>
                  <Mic size={15} /> {busy.startsWith('voice:') ? 'Bana rahe hain...' : 'Voiceover banayein'}
                </button>
              </div>
              <p className="mt-2 text-xs text-dim">Stored voiceovers: {voices.length ? voices.join(', ') : 'koi nahi'}</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'ads' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card space-y-4">
            <h2 className="section-title !text-xl">Products &amp; ad break</h2>
            <Switch label="Ad breaks on" hint="Har cycle ke baad product ad chalta hai" checked={shown.ads.enabled} onChange={(v) => setAds('enabled', v)} />
            <Num label="Ad break (seconds)" value={cfg.ads.seconds} min={10} max={120} onChange={(v) => setAds('seconds', v)} />
            <Pick label="Default AI voice for the ads" value={cfg.ads.voiceName} onChange={(v) => setAds('voiceName', v)} options={TTS_VOICES.map((v) => [v, v])} />
            <div>
              <span className="label">Product dhoondein aur ad mein add karein</span>
              <div className="flex gap-2">
                <input className="input" placeholder="product ka naam..." value={pq} onChange={(e) => setPq(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchProducts()} />
                <button type="button" className="btn-ghost !px-4 !py-2 text-sm" onClick={searchProducts} disabled={busy === 'search'}>{busy === 'search' ? '...' : 'Search'}</button>
              </div>
              <div className="mt-2 space-y-1">
                {hits.map((h) => (
                  <button key={h.slug} type="button" onClick={() => addAd(h.slug)} className="flex w-full items-center gap-2 rounded-lg border border-line bg-raised p-2 text-left text-sm hover:border-gold">
                    <Plus size={14} className="text-gold" /> {h.name} <span className="ml-auto text-dim">Rs {Number(h.price || 0).toLocaleString('en-PK')}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="card space-y-3">
            <h2 className="section-title !text-xl">Ad list ({shown.ads.slugs.length})</h2>
            {!shown.ads.slugs.length && <p className="text-sm text-dim">Abhi koi product add nahi hua. Baayen taraf se search karke add karein.</p>}
            {shown.ads.slugs.map((slug) => {
              const id = adVoiceId(slug);
              const has = voices.includes(id);
              return (
                <div key={slug} className="rounded-xl border border-line bg-raised p-3">
                  <div className="flex items-center gap-2">
                    <b className="min-w-0 flex-1 truncate text-sm">{slug}</b>
                    {has ? <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold">AI voice ready</span> : <span className="rounded-full bg-raised px-2 py-0.5 text-xs font-bold text-faint">voice baqi</span>}
                    <button type="button" className="text-red-600" onClick={() => setAds('slugs', shown.ads.slugs.filter((s) => s !== slug))} aria-label="Remove"><Trash2 size={16} /></button>
                  </div>
                  <textarea className="input mt-2 min-h-[64px] text-sm" placeholder="AI voiceover script (jo awaaz bolegi)..."
                    value={adScripts[slug] || ''} onChange={(e) => setAdScripts((m) => ({ ...m, [slug]: e.target.value }))} maxLength={600} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className="btn-gold !px-3 !py-1.5 text-xs" disabled={busy === `voice:${id}`}
                      onClick={() => genVoice(id, adScripts[slug] || `Mizanora Market se ${slug.replace(/-/g, ' ')} — abhi order karein, cash on delivery pooray Pakistan mein.`, cfg.ads.voiceName, 'ad')}>
                      <Wand2 size={13} /> {busy === `voice:${id}` ? 'Bana rahe hain...' : has ? 'Voiceover dobara banayein' : 'AI voiceover banayein'}
                    </button>
                    {has && (
                      <>
                        <audio controls preload="none" src={`/api/live/voice/${id}.wav`} className="h-8" />
                        <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => delVoice(id)}>Delete voice</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'youtube' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card space-y-4">
            <h2 className="section-title !text-xl flex items-center gap-2"><Youtube className="text-red-600" /> YouTube live cast</h2>
            {!yt.configured && <p className="rounded-xl bg-raised p-3 text-sm text-dim">{yt.hint || 'YouTube API set nahi hai. Vercel mein YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET aur YOUTUBE_REFRESH_TOKEN add karein (UPGRADE-v27.md mein pura tareeqa hai).'}</p>}
            {yt.configured && <p className="rounded-xl bg-gold/10 p-3 text-sm text-gold">YouTube API connected hai. Neeche se live broadcast banayein — phir GitHub Action (Live Channel) usko stream karega.</p>}
            <label className="block text-sm"><span className="label">Broadcast title</span>
              <input className="input" value={cfg.youtube.title} placeholder={cfg.title} onChange={(e) => setYtCfg('title', e.target.value)} maxLength={100} /></label>
            <Pick label="Privacy" value={cfg.youtube.privacy} onChange={(v) => setYtCfg('privacy', v)} options={YT_PRIVACY} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-gold !px-5 !py-2.5 text-sm" disabled={busy === 'yt' || !yt.configured} onClick={ytCreate}>
                <Youtube size={16} /> {busy === 'yt' ? 'Bana rahe hain...' : 'Create YouTube live broadcast'}
              </button>
              <button type="button" className="btn-ghost !px-4 !py-2.5 text-sm" disabled={busy === 'yt'} onClick={ytEnd}><Square size={15} /> End broadcast</button>
            </div>
            {last && (
              <div className="space-y-2 rounded-xl border border-line bg-raised p-3 text-sm">
                <p><b>Watch URL:</b> <a className="text-gold underline" href={last.watchUrl} target="_blank" rel="noreferrer">{last.watchUrl}</a></p>
                <p className="break-all"><b>RTMPS:</b> <span className="font-mono text-xs">{last.rtmpUrl}</span></p>
                <p className="break-all"><b>Stream key:</b> <span className="font-mono text-xs">{last.streamKey ? `${last.streamKey.slice(0, 8)}${'•'.repeat(12)}` : '—'}</span></p>
                <p className="text-dim">Yeh key GitHub secret <b>YOUTUBE_STREAM_KEY</b> mein rakhein — phir neeche wala action YouTube par live chalayega.</p>
              </div>
            )}
          </div>
          <div className="card space-y-4">
            <h2 className="section-title !text-xl flex items-center gap-2"><Tv size={20} /> Cast action (GitHub) — 24/7</h2>
            <p className="text-sm text-dim">
              Repo ka <b>Live Channel</b> action channel ko <b>24/7</b> chalata hai: ek run <b>5.5 ghante</b> tak ek hi
              ffmpeg ke sath non-stop push karta hai (beech mein ek second ka restart nahi), phir agla run queued hota
              hai aur foran接力 le leta hai. Har 30 minute ka cron safety net hai. Chal raha run jab khatam hone lagta
              hai to khud agla run dispatch kar deta hai (baton). Band schedule mein khud hi ruk jata hai.
            </p>
            <pre className="overflow-x-auto rounded-xl bg-[#0B1A13] p-3 text-xs text-[#D9F3E4]">{castCmd}</pre>
            <p className="text-sm text-dim">Secrets (repo → Settings → Secrets → Actions): <b>YOUTUBE_STREAM_KEY</b> (zaroori), <b>LIVE_CHANNEL_API</b> (site ka origin, maslan https://mizanora.vercel.app).</p>
            <p className="text-sm text-dim">
              <b>Zero-gap 24/7:</b> apne PC ya VPS par <span className="font-mono text-xs">npm run cast:live -- --loop</span> chalayein —
              ek hi process hafteon chalta hai, sirf asli network failure par reconnect. GitHub runners ki 6-hour limit
              ki wajah se wahan din mein 2 baar ~1 minute ka handover hota hai (broadcast live rehta hai).
            </p>
            <button type="button" className="btn-ghost !px-4 !py-2 text-sm" onClick={() => { navigator.clipboard.writeText(castCmd); setMsg('Command copy ho gaya.'); }}>
              <Copy size={15} /> Copy command
            </button>
            <p className="text-xs text-dim"><Clock3 size={12} className="inline" /> Stream key ko kabhi WhatsApp ya public link par share na karein.</p>
          </div>
        </div>
      )}
    </div>
  );
}
