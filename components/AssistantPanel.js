'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Check, Mic, MicOff, Phone, PhoneOff, Play, Radio, RefreshCw, Send, Share2, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { useCartActions } from './CartProvider';
import { addToCart } from '@/lib/metaPixel';
import { formatPKR } from '@/lib/format';
import { saveDeal } from '@/lib/dealStore';
import { createVoice, isEcho } from '@/lib/assistantVoice';
import { askMic, micHelp, micPermission, micSupported, recognizer, srMessage } from '@/lib/mic';

// A made-up device id (localStorage). It carries no name, phone or account - it only lets the assistant remember
// which categories THIS phone likes, and it is the same id the home page "Aap ke liye" shelf reads.
function deviceId() {
  try {
    let d = localStorage.getItem('mz_did');
    if (!d) { d = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6); localStorage.setItem('mz_did', d); }
    return d;
  } catch (_) { return ''; }
}

// Languages the shopper can speak in. en-IN understands Roman Urdu and Hinglish best (it writes them in Latin letters).
const LANGS = [['en-IN', 'Roman Urdu / English'], ['ur-PK', 'اردو (Urdu)']];
const LANG_KEY = 'mz_voice_lang';

function Dots() {
  return <span className="inline-flex gap-1" aria-label="typing"><i className="h-2 w-2 animate-bounce rounded-full bg-dim [animation-delay:-.3s]" /><i className="h-2 w-2 animate-bounce rounded-full bg-dim [animation-delay:-.15s]" /><i className="h-2 w-2 animate-bounce rounded-full bg-dim" /></span>;
}

function Thumb({ src, size = 64, video = '' }) {
  if (src) return <Image src={src} alt="" width={size} height={size} sizes={`${size}px`} className="h-full w-full object-cover" />;
  if (video) return <span className="grid h-full w-full place-items-center bg-gradient-to-br from-[#0E8556] to-[#073D28] text-white" title="Video product"><Play size={22} /></span>;
  return <span className="grid h-full w-full place-items-center bg-raised font-display text-bronze">M</span>;
}

export default function AssistantPanel({ cfg, open, initialQuery, onClose }) {
  const path = usePathname() || '/';
  const slug = (/^\/product\/([^/?#]+)/.exec(path) || [])[1] || '';
  const { add } = useCartActions();

  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [micOk, setMicOk] = useState(false);          // does this browser support voice at all?
  const [perm, setPerm] = useState('unknown');        // granted | prompt | denied | unknown
  const [help, setHelp] = useState(null);             // { title, steps[] } shown inside the chat
  const [loop, setLoop] = useState(true);             // hands-free: keep the conversation going by voice
  const [lang, setLang] = useState('en-IN');
  const [note, setNote] = useState('');               // short, friendly line about the last voice problem
  const [added, setAdded] = useState({});
  const [call, setCall] = useState(false);            // voice call mode: big orb, hands-free, hang-up button

  // Everything the voice code reads lives in refs, so a callback can never see an old value (no stale closures).
  const modeRef = useRef(cfg.voiceMode);
  modeRef.current = cfg.voiceMode;
  const voice = useMemo(() => createVoice(() => modeRef.current), []);
  const neg = useRef('');
  const msgsRef = useRef([]);
  const busyRef = useRef(false);
  const voiceOnRef = useRef(true);
  const loopRef = useRef(true);
  const permRef = useRef('unknown');
  const langRef = useRef('en-IN');
  const openRef = useRef(open);
  openRef.current = open;
  const slugRef = useRef(slug);
  slugRef.current = slug;
  const recRef = useRef(null);            // the running SpeechRecognition (if any)
  const listeningRef = useRef(false);
  const startingRef = useRef(false);     // a start is in progress (waiting for the mic permission)
  const autoRef = useRef(false);          // true while a voice conversation is going on (keep listening after each answer)
  const finalRef = useRef('');            // what was heard in this listening turn
  const misses = useRef(0);               // turns in a row with nothing heard
  const speakId = useRef(0);
  const timer = useRef(null);
  const sendRef = useRef(null);
  const listenRef = useRef(null);
  const didRef = useRef('');
  const scroller = useRef(null);
  const greeted = useRef(false);
  const lastSpokenRef = useRef('');       // her last words (used to recognise her own voice in the microphone)

  const setPermission = (p) => { permRef.current = p; setPerm(p); };

  // Stop everything that is running: speech, the timer, the microphone.
  const stopAll = () => {
    autoRef.current = false;
    clearTimeout(timer.current);
    voice.stop();
    const r = recRef.current;
    recRef.current = null;
    listeningRef.current = false;
    if (r) { r.onresult = null; r.onend = null; r.onerror = null; try { r.abort(); } catch (_) { /* ignore */ } }
    setListening(false);
  };

  useEffect(() => { msgsRef.current = msgs; if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [msgs, busy]);
  useEffect(() => { voiceOnRef.current = voiceOn; if (!voiceOn) voice.stop(); }, [voiceOn, voice]);
  useEffect(() => { loopRef.current = loop; if (!loop) autoRef.current = false; }, [loop]);
  useEffect(() => { didRef.current = deviceId(); }, []);
  useEffect(() => {
    setMicOk(micSupported());
    try {
      if (localStorage.getItem('mz_ai_voice') === '0') setVoiceOn(false);
      if (localStorage.getItem('mz_voice_loop') === '0') { setLoop(false); loopRef.current = false; }
      const l = localStorage.getItem(LANG_KEY);
      if (l === 'en-IN' || l === 'ur-PK') { setLang(l); langRef.current = l; }
    } catch (_) { /* ignore */ }
    return () => { stopAll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice]);

  // Permission state is re-read every time the panel opens (the shopper may have just allowed it in settings).
  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    micPermission().then((p) => { if (live) setPermission(p); }).catch(() => {});
    return () => { live = false; };
  }, [open]);

  // Speak, and tell the screen when she is talking (only the newest speech counts, so the status never flickers).
  const say = (t) => {
    lastSpokenRef.current = String(t || '');
    if (!voiceOnRef.current) return Promise.resolve();
    const id = ++speakId.current;
    setSpeaking(true);
    return voice.speak(t).finally(() => { if (speakId.current === id) setSpeaking(false); });
  };

  // Send one message (typed or spoken) and speak the answer.
  const send = async (raw, fromVoice = false) => {
    const t = String(raw || '').trim().slice(0, 300);
    if (!t || busyRef.current) return;
    clearTimeout(timer.current);
    voice.stop();
    setSpeaking(false);
    busyRef.current = true; setBusy(true); setText('');
    const next = [...msgsRef.current, { role: 'user', text: t }];
    msgsRef.current = next; setMsgs(next);
    let reply = { text: 'Maazrat, abhi jawab nahi de saki. Dobara koshish karein.' };
    try {
      const r = await fetch('/api/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, text: m.text })), slug: slugRef.current, neg: neg.current, did: didRef.current }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.neg) neg.current = j.neg;
      if (j.text) reply = j;
      // Her memory of this shopper's taste, mirrored onto the device: the home page "Aap ke liye" shelf uses this copy.
      if (j.prefs && j.prefs.cats) { try { localStorage.setItem('mz_ai_prefs', JSON.stringify({ cats: j.prefs.cats, at: Date.now() })); } catch (_) { /* ignore */ } }
    } catch (_) { /* offline: keep the polite message */ }
    const withReply = [...next, { role: 'assistant', text: reply.text, products: reply.products || [], deals: reply.deals || [] }];
    msgsRef.current = withReply; setMsgs(withReply);
    busyRef.current = false; setBusy(false);
    await say(reply.text);
    // Voice conversation: after she answers, wait a moment (so the microphone does not hear the end of her voice), then listen again.
    if (fromVoice && autoRef.current && loopRef.current && openRef.current) {
      timer.current = setTimeout(() => {
        if (voice.isBusy()) { timer.current = setTimeout(() => listenRef.current && listenRef.current(true), 500); return; }
        listenRef.current && listenRef.current(true);
      }, 800);
    }
  };

  // Start listening. quiet = started by the assistant itself (no popup-style error messages for a missed turn).
  const listenNow = async (quiet = false) => {
    if (startingRef.current) return;
    // She is still talking: the microphone waits, otherwise it would hear her and answer herself.
    if (voice.isBusy()) { clearTimeout(timer.current); timer.current = setTimeout(() => listenRef.current && listenRef.current(quiet), 300); return; }
    startingRef.current = true;
    try { await startRecognition(quiet); } finally { startingRef.current = false; }
  };
  const startRecognition = async (quiet) => {
    const Rec = recognizer();
    if (!Rec) { setHelp(micHelp('unsupported')); setMicOk(false); autoRef.current = false; return; }
    if (listeningRef.current || busyRef.current || !openRef.current) return;
    voice.stop();
    // Ask for the microphone (this is what shows the Allow popup). Once granted, it is not asked again.
    if (permRef.current !== 'granted') {
      const ask = await askMic();
      if (!ask.ok) {
        autoRef.current = false;
        if (ask.reason === 'denied') setPermission('denied');
        if (!quiet) setHelp(micHelp(ask.reason));
        return;
      }
      setPermission('granted');
    }
    if (busyRef.current || !openRef.current) return;
    setHelp(null); setNote('');
    const r = new Rec();
    r.lang = langRef.current; r.interimResults = true; r.maxAlternatives = 1; r.continuous = false;
    finalRef.current = '';
    r.onstart = () => { listeningRef.current = true; setListening(true); };
    r.onresult = (e) => {
      misses.current = 0; setNote('');
      let fin = finalRef.current, interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const s = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += s; else interim += s;
      }
      finalRef.current = fin;
      setText(fin + interim);
    };
    r.onerror = (e) => {
      const code = String((e && e.error) || '');
      if (code === 'aborted') return;                         // we stopped it on purpose
      if (code === 'no-speech') return;                       // nothing said: onend decides whether to listen again
      const msg = srMessage(code);
      if (msg) setNote(msg);
      if (code === 'not-allowed') { autoRef.current = false; setPermission('denied'); setHelp(micHelp('denied')); }
      else if (code === 'service-not-allowed') { autoRef.current = false; setHelp(micHelp('unsupported')); }
      else if (code === 'audio-capture') { autoRef.current = false; setHelp(micHelp('nodevice')); }
    };
    r.onend = () => {
      listeningRef.current = false; recRef.current = null; setListening(false);
      let heard = finalRef.current.trim();
      finalRef.current = '';
      // Her own voice picked up by the microphone is not a question from the shopper: drop it.
      if (heard && isEcho(heard, lastSpokenRef.current)) heard = '';
      if (heard) { misses.current = 0; sendRef.current(heard, true); return; }
      if (!openRef.current) return;
      if (autoRef.current && loopRef.current) {
        misses.current += 1;
        if (misses.current >= 3) {
          autoRef.current = false;
          setNote('Main kuch sun nahi pa rahi. Mic button dabayein, phir boliye.');
          return;
        }
        timer.current = setTimeout(() => listenRef.current && listenRef.current(true), 500);
      }
    };
    recRef.current = r;
    try { r.start(); }
    catch (_) { listeningRef.current = false; setListening(false); autoRef.current = false; }
  };

  // Keep the latest functions reachable from the recogniser callbacks and timers.
  sendRef.current = send;
  listenRef.current = listenNow;

  // Tap the mic: start, or stop (sends what was heard so far). While she is speaking, a tap stops her and listens (barge-in).
  const toggleMic = () => {
    voice.unlock();
    if (listeningRef.current) { autoRef.current = false; try { if (recRef.current) recRef.current.stop(); } catch (_) { /* ignore */ } return; }
    clearTimeout(timer.current);
    voice.stop();
    misses.current = 0;
    autoRef.current = loopRef.current;
    listenNow(false);
  };
  const toggleLoop = () => {
    const n = !loopRef.current;
    loopRef.current = n; setLoop(n);
    if (!n) autoRef.current = false;
    try { localStorage.setItem('mz_voice_loop', n ? '1' : '0'); } catch (_) { /* ignore */ }
  };
  const changeLang = (v) => {
    langRef.current = v; setLang(v);
    try { localStorage.setItem(LANG_KEY, v); } catch (_) { /* ignore */ }
  };
  const retryMic = () => { setHelp(null); voice.unlock(); misses.current = 0; autoRef.current = loopRef.current; listenNow(false); };
  const toggleVoice = () => {
    voice.unlock();
    const n = !voiceOnRef.current;
    voiceOnRef.current = n; setVoiceOn(n);
    try { localStorage.setItem('mz_ai_voice', n ? '1' : '0'); } catch (_) { /* ignore */ }
    if (!n) voice.stop();
  };

  // Opening: greet (spoken). If the mic is already allowed and hands-free is on, she starts listening by herself after the greeting.
  // A question handed over from the search box is answered straight away.
  useEffect(() => {
    if (!open || greeted.current) return;
    greeted.current = true;
    voice.unlock();
    const hello = cfg.greeting || `Assalam o Alaikum! Main ${cfg.name} hoon, Mizanora ki assistant. Main aapko deals ya cheezein dikha sakti hoon. Aap bol kar ya likh kar bataiye, kya dekhna hai?`;
    setMsgs([{ role: 'assistant', text: hello }]);
    msgsRef.current = [{ role: 'assistant', text: hello }];
    if (initialQuery) { setTimeout(() => sendRef.current(initialQuery), 150); return; }
    (async () => {
      await say(hello);
      if (permRef.current === 'granted' && loopRef.current && openRef.current && !busyRef.current) {
        autoRef.current = true;
        listenRef.current(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => { if (open && greeted.current && initialQuery) sendRef.current(initialQuery); }, [initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps
  // Closing the panel stops the voice and the microphone at once.
  useEffect(() => { if (!open) stopAll(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);

  // Voice call: one tap starts a hands-free conversation (like a phone call), the hang-up button ends it.
  const startCall = () => {
    voice.unlock();
    setCall(true);
    loopRef.current = true; setLoop(true);
    autoRef.current = true; misses.current = 0;
    say('Ji, boliye. Main sun rahi hoon.').then(() => { if (openRef.current && autoRef.current) listenRef.current(false); });
  };
  const endCall = () => { setCall(false); stopAll(); };

  const addCard = (p) => {
    const prod = { id: p.slug, slug: p.slug, name: p.name, price: p.price, images: p.image ? [p.image] : [] };
    add(prod, { qty: 1 }); addToCart(prod, 1);
    setAdded((a) => ({ ...a, [p.slug]: true }));
  };
  const takeDeal = (d) => {
    saveDeal(d.slug, d.off, d.token); // from now on the deal price is used wherever this product is added
    if (!d.hasOptions) addCard({ slug: d.slug, name: d.name, price: d.price, image: d.image });
    setAdded((a) => ({ ...a, [`deal:${d.slug}`]: true }));
  };

  const chips = [slug ? 'Is ka rate kam karo' : 'Sab se sasti deals dikhao', 'Rs 1000 se kam cheezein', 'Aaj ki best deals', 'Delivery kaise hoti hai?'];
  if (!open) return null;

  const status = listening ? 'Sun rahi hoon... boliye'
    : busy ? 'Soch rahi hoon...'
      : speaking ? 'Bol rahi hoon...'
        : loop && micOk ? 'Hands-free: boliye ya likhein' : 'Boliye ya likhein';

  return (
    <div className="fixed inset-0 z-[60] md:inset-auto md:bottom-5 md:right-5" role="dialog" aria-modal="true" aria-label={`${cfg.name} - Mizanora assistant`}>
      <button type="button" className="absolute inset-0 bg-black/40 md:hidden" aria-label="Close assistant" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 flex h-[84dvh] flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl md:relative md:h-[620px] md:w-[400px] md:rounded-3xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <header className="flex items-center gap-3 bg-gradient-to-r from-[#0B6B45] to-[#0E8556] px-4 py-3 text-white">
          <span className={`relative grid h-10 w-10 place-items-center rounded-full bg-white/15 ${listening ? 'ring-2 ring-red-300' : speaking ? 'ring-2 ring-gold' : ''}`}>
            <Sparkles size={20} />
            {(busy || listening || speaking) && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full bg-gold" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-bold leading-tight">{cfg.name}</p>
            <p className="flex items-center gap-1.5 text-xs text-white/85" aria-live="polite">
              {listening && <span className="mz-wave" aria-hidden="true"><i /><i /><i /><i /></span>}
              {status}
            </p>
          </div>
          <button type="button" onClick={toggleMic} aria-label={listening ? 'Stop listening' : 'Talk to the assistant'} aria-pressed={listening} disabled={!micOk}
            className={`grid h-9 w-9 place-items-center rounded-full hover:bg-white/15 disabled:opacity-50 ${listening ? 'bg-red-600/90' : ''}`}>{micOk ? <Mic size={18} /> : <MicOff size={18} />}</button>
          <button type="button" onClick={toggleVoice} aria-label={voiceOn ? 'Mute her voice' : 'Turn her voice on'} aria-pressed={voiceOn} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15">{voiceOn ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15"><X size={20} /></button>
        </header>

        {/* Mic status, hands-free switch and language: everything about the voice in ONE slim bar, in plain words. */}
        {micOk && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-raised px-4 py-1.5 text-[0.7rem]">
            <button type="button" onClick={retryMic} className="flex items-center gap-1.5 font-bold text-cream">
              {perm === 'granted' ? <><span className="h-2 w-2 rounded-full bg-emerald-500" /> Mic ready</> : perm === 'denied' ? <><span className="h-2 w-2 rounded-full bg-red-500" /> Mic band hai - theek karein</> : <><span className="h-2 w-2 rounded-full bg-amber-500" /> Mic permission chahiye</>}
            </button>
            <button type="button" onClick={toggleLoop} aria-pressed={loop} className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 font-bold ${loop ? 'bg-gold/15 text-gold' : 'text-dim'}`}>
              <Radio size={12} /> Hands-free {loop ? 'ON' : 'OFF'}
            </button>
            <button type="button" onClick={startCall} className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 font-bold text-white"><Phone size={12} /> Voice call</button>
            <select value={lang} onChange={(e) => changeLang(e.target.value)} aria-label="Bolne ki zubaan" className="rounded-full border border-line bg-surface px-2 py-0.5 text-[0.7rem] font-semibold text-cream outline-none">
              {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )}
        {note && (
          <p className="border-b border-line bg-amber-50 px-4 py-1.5 text-[0.7rem] font-semibold text-amber-900">{note}</p>
        )}

        {call && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#0B6B45] to-[#06301F] px-6 text-center text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">Voice call - {cfg.name}</p>
            <span className="relative grid h-40 w-40 place-items-center">
              {(listening || speaking || busy) && <span className="absolute inset-0 animate-ping rounded-full bg-gold/40 [animation-duration:2s]" aria-hidden="true" />}
              <span className={`relative grid h-32 w-32 place-items-center rounded-full bg-gradient-to-br from-gold to-[#0E8556] shadow-2xl ${listening ? 'ring-4 ring-red-300' : speaking ? 'ring-4 ring-white/60' : ''}`}>
                <Sparkles size={44} />
              </span>
            </span>
            <p className="text-xl font-extrabold" aria-live="polite">{status}</p>
            <p className="line-clamp-3 min-h-[3rem] max-w-xs text-sm text-white/85">{listening && text ? `"${text}"` : (msgs.length && msgs[msgs.length - 1].role === 'assistant' ? msgs[msgs.length - 1].text : '')}</p>
            <p className="max-w-xs text-xs text-white/60">Headphones lagaayein to behtar: speaker ki awaaz dobara nahi sunai degi.</p>
            <div className="flex items-center gap-5">
              <button type="button" onClick={toggleMic} aria-label={listening ? 'Stop listening' : 'Speak'} className={`grid h-14 w-14 place-items-center rounded-full ${listening ? 'bg-white text-red-600' : 'bg-white/15 text-white'}`}>{listening ? <MicOff size={24} /> : <Mic size={24} />}</button>
              <button type="button" onClick={endCall} aria-label="End call" className="grid h-16 w-16 place-items-center rounded-full bg-red-600 text-white shadow-xl active:scale-95"><PhoneOff size={28} /></button>
            </div>
          </div>
        )}
        <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4" style={{ touchAction: 'pan-y' }}>
          {msgs.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex flex-col items-start gap-2'}>
              <p className={`max-w-[86%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'rounded-br-sm bg-gold text-white' : 'rounded-bl-sm bg-raised text-cream'}`}>{m.text}</p>
              {(m.deals || []).map((d) => (
                <div key={d.slug + d.token.slice(-6)} className="w-full max-w-[92%] rounded-2xl border-2 border-gold bg-gold/5 p-3">
                  <p className="text-[0.65rem] font-extrabold uppercase tracking-wider text-gold">Special deal for you</p>
                  <div className="mt-2 flex gap-3">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-raised"><Thumb src={d.image} /></div>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-medium text-cream">{d.name}</p>
                      <p className="mt-1"><span className="text-lg font-extrabold text-gold">{formatPKR(d.newPrice)}</span> <span className="text-xs text-faint line-through">{formatPKR(d.price)}</span> <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[0.65rem] font-bold text-white">-Rs {d.off}</span></p>
                    </div>
                  </div>
                  {added[`deal:${d.slug}`] ? (
                    <Link href={d.hasOptions ? `/product/${d.slug}` : '/cart'} onClick={onClose} className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-gold py-2.5 text-sm font-bold text-white"><Check size={16} />{d.hasOptions ? 'Choose size/colour (deal is saved)' : 'Added! Open cart'}</Link>
                  ) : (
                    <button type="button" onClick={() => takeDeal(d)} className="mt-3 w-full rounded-full bg-gold py-2.5 text-sm font-bold text-white active:bg-goldhi">{d.hasOptions ? 'Take this deal' : `Add to cart at ${formatPKR(d.newPrice)}`}</button>
                  )}
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Mizanora deal: ${d.name} - Rs ${d.newPrice} (Rs ${d.off} off) ${typeof window !== 'undefined' ? window.location.origin : ''}/product/${d.slug}`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="mt-2 flex items-center justify-center gap-1.5 rounded-full border border-gold py-2 text-xs font-bold text-gold"
                  ><Share2 size={14} /> Share this deal</a>
                </div>
              ))}
              {(m.products || []).length > 0 && (
                <div className="no-sb -mx-1 flex w-full gap-2 overflow-x-auto px-1 pb-1">
                  {m.products.map((p) => (
                    <div key={p.slug} className="w-36 shrink-0 overflow-hidden rounded-xl border border-line bg-surface">
                      <Link href={`/product/${p.slug}`} onClick={onClose} className="block">
                        <div className="relative aspect-square bg-raised"><Thumb src={p.image} size={144} video={p.video} /></div>
                        <p className="line-clamp-2 min-h-[2.2rem] px-2 pt-1.5 text-xs font-medium leading-snug text-cream">{p.name}</p>
                        <p className="px-2 pb-1.5 text-sm font-bold text-gold">{formatPKR(p.price)}</p>
                      </Link>
                      <div className="px-2 pb-2">
                        {p.hasOptions ? <Link href={`/product/${p.slug}`} onClick={onClose} className="block rounded-full border border-gold py-1.5 text-center text-xs font-semibold text-gold">Choose options</Link>
                          : <button type="button" onClick={() => addCard(p)} className="w-full rounded-full bg-gold py-1.5 text-xs font-bold text-white active:bg-goldhi">{added[p.slug] ? 'Added' : 'Add to cart'}</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {busy && <div className="flex"><p className="rounded-2xl rounded-bl-sm bg-raised px-4 py-3"><Dots /></p></div>}
          {help && (
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-3">
              <p className="font-bold text-amber-900">{help.title}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-amber-900">
                {help.steps.map((t) => <li key={t}>{t}</li>)}
              </ol>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={retryMic} className="rounded-full bg-gold px-4 py-2 text-xs font-bold text-white"><RefreshCw size={13} className="mr-1 inline" /> Try again</button>
                <button type="button" onClick={() => setHelp(null)} className="rounded-full border border-line px-4 py-2 text-xs font-bold text-cream">Theek hai</button>
              </div>
            </div>
          )}
          {msgs.length <= 1 && !busy && (
            <div className="flex flex-wrap gap-2 pt-1">{chips.map((c) => <button key={c} type="button" onClick={() => send(c)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-cream active:bg-raised">{c}</button>)}</div>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); voice.unlock(); send(text); }} className="flex items-center gap-2 border-t border-line bg-surface px-3 py-2.5">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={listening ? 'Boliye, main sun rahi hoon...' : 'Likhein ya bol kar poochein...'} maxLength={300} enterKeyHint="send"
            className="min-w-0 flex-1 rounded-full border border-line bg-raised px-4 py-2.5 text-base outline-none focus:border-gold" aria-label="Message" />
          <button type="button" onClick={micOk ? toggleMic : () => setHelp(micHelp('unsupported'))} aria-label={listening ? 'Stop listening' : 'Speak'} aria-pressed={listening}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${listening ? 'bg-red-600 text-white' : 'bg-raised text-gold'}`}>
            {micOk ? <Mic size={20} className={listening ? 'animate-pulse' : ''} /> : <MicOff size={20} />}
          </button>
          <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold text-white disabled:opacity-40"><Send size={18} /></button>
        </form>
      </div>
    </div>
  );
}
