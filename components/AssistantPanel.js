'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Check, Mic, Send, Share2, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { useCartActions } from './CartProvider';
import { addToCart } from '@/lib/metaPixel';
import { formatPKR } from '@/lib/format';
import { saveDeal } from '@/lib/dealStore';
import { createVoice } from '@/lib/assistantVoice';

const SR = () => (typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null);

// A made-up device id (localStorage). It carries no name, phone or account - it only lets the assistant remember
// which categories THIS phone likes, and it is the same id the home page "Aap ke liye" shelf reads.
function deviceId() {
  try {
    let d = localStorage.getItem('mz_did');
    if (!d) { d = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6); localStorage.setItem('mz_did', d); }
    return d;
  } catch (_) { return ''; }
}

function Dots() {
  return <span className="inline-flex gap-1" aria-label="typing"><i className="h-2 w-2 animate-bounce rounded-full bg-dim [animation-delay:-.3s]" /><i className="h-2 w-2 animate-bounce rounded-full bg-dim [animation-delay:-.15s]" /><i className="h-2 w-2 animate-bounce rounded-full bg-dim" /></span>;
}

function Thumb({ src, size = 64 }) {
  return src
    ? <Image src={src} alt="" width={size} height={size} sizes={`${size}px`} className="h-full w-full object-cover" />
    : <span className="grid h-full w-full place-items-center bg-raised font-display text-bronze">M</span>;
}

export default function AssistantPanel({ cfg, open, initialQuery, onClose }) {
  const path = usePathname() || '/';
  const slug = (/^\/product\/([^/?#]+)/.exec(path) || [])[1] || '';
  const { add } = useCartActions();

  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [micOk, setMicOk] = useState(false);
  const [added, setAdded] = useState({});

  const neg = useRef('');
  const msgsRef = useRef([]);
  const voiceOnRef = useRef(true);
  const recRef = useRef(null);
  const viaVoice = useRef(false);
  const scroller = useRef(null);
  const greeted = useRef(false);
  const busyRef = useRef(false);
  const modeRef = useRef(cfg.voiceMode);
  const didRef = useRef('');
  const voice = useMemo(() => createVoice(() => modeRef.current), []);

  useEffect(() => { msgsRef.current = msgs; if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [msgs, busy]);
  useEffect(() => { voiceOnRef.current = voiceOn; if (!voiceOn) voice.stop(); }, [voiceOn, voice]);
  useEffect(() => { didRef.current = deviceId(); }, []);
  useEffect(() => {
    setMicOk(Boolean(SR()));
    try { if (localStorage.getItem('mz_ai_voice') === '0') setVoiceOn(false); } catch (_) { /* ignore */ }
    return () => { voice.stop(); try { if (recRef.current) recRef.current.abort(); } catch (_) { /* ignore */ } };
  }, [voice]);

  const stopListen = useCallback(() => { viaVoice.current = false; try { if (recRef.current) recRef.current.stop(); } catch (_) { /* ignore */ } setListening(false); }, []);

  const say = useCallback(async (t) => { if (voiceOnRef.current) await voice.speak(t); }, [voice]);

  const send = useCallback(async (raw, fromVoice = false) => {
    const t = String(raw || '').trim().slice(0, 300);
    if (!t || busyRef.current) return;
    viaVoice.current = fromVoice;
    voice.stop();
    busyRef.current = true; setBusy(true); setText('');
    const next = [...msgsRef.current, { role: 'user', text: t }];
    msgsRef.current = next; setMsgs(next);
    let reply = { text: 'Maazrat, abhi jawab nahi de saki. Dobara koshish karein.' };
    try {
      const r = await fetch('/api/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, text: m.text })), slug, neg: neg.current, did: didRef.current }),
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
    if (fromVoice && viaVoice.current && SR()) startListen(true); // keep the conversation going by voice
  }, [slug, say, voice]); // eslint-disable-line react-hooks/exhaustive-deps

  const startListen = useCallback((quiet = false) => {
    const Rec = SR();
    if (!Rec) return;
    voice.stop();
    let lang = 'ur-PK';
    try { const l = localStorage.getItem('mz_voice_lang'); if (l === 'en-PK' || l === 'ur-PK') lang = l; } catch (_) { /* ignore */ }
    const r = new Rec();
    r.lang = lang; r.interimResults = true; r.maxAlternatives = 1;
    let finalText = '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const s = e.results[i][0].transcript; if (e.results[i].isFinal) finalText += s; else interim += s; }
      setText(finalText + interim);
    };
    r.onerror = () => { setListening(false); if (quiet) viaVoice.current = false; };
    r.onend = () => { setListening(false); if (finalText.trim()) send(finalText, true); else viaVoice.current = false; };
    recRef.current = r;
    try { r.start(); setListening(true); } catch (_) { setListening(false); }
  }, [send, voice]);

  // Barge-in: tap the mic while she is speaking and she stops, then listens (like talking over her on a phone call).
  const toggleMic = () => { voice.unlock(); voice.stop(); if (listening) stopListen(); else startListen(); };
  const toggleVoice = () => { voice.unlock(); setVoiceOn((v) => { try { localStorage.setItem('mz_ai_voice', v ? '0' : '1'); } catch (_) { /* ignore */ } return !v; }); };

  // Opening: greet (spoken), then answer a question that was handed over from the search box.
  useEffect(() => {
    if (!open || greeted.current) return;
    greeted.current = true;
    voice.unlock();
    const hello = cfg.greeting || `Assalam o Alaikum! Main ${cfg.name} hoon, Mizanora ki assistant. Main aapko deals ya cheezein dikha sakti hoon. Aap bol kar ya likh kar bataiye, kya dekhna hai?`;
    setMsgs([{ role: 'assistant', text: hello }]);
    msgsRef.current = [{ role: 'assistant', text: hello }];
    if (initialQuery) setTimeout(() => send(initialQuery), 150); else say(hello);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && greeted.current && initialQuery) send(initialQuery); }, [initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!open) { voice.stop(); stopListen(); } }, [open, voice, stopListen]);
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);

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

  return (
    <div className="fixed inset-0 z-[60] md:inset-auto md:bottom-5 md:right-5" role="dialog" aria-modal="true" aria-label={`${cfg.name} - Mizanora assistant`}>
      <button type="button" className="absolute inset-0 bg-black/40 md:hidden" aria-label="Close assistant" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 flex h-[84dvh] flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl md:static md:h-[620px] md:w-[400px] md:rounded-3xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <header className="flex items-center gap-3 bg-gradient-to-r from-[#0B6B45] to-[#0E8556] px-4 py-3 text-white">
          <span className="relative grid h-10 w-10 place-items-center rounded-full bg-white/15"><Sparkles size={20} />{(busy || listening) && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full bg-gold" />}</span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-bold leading-tight">{cfg.name}</p>
            <p className="text-xs text-white/80">{listening ? 'Sun rahi hoon...' : busy ? 'Soch rahi hoon...' : 'Mizanora shopping assistant'}</p>
          </div>
          <button type="button" onClick={toggleVoice} aria-label={voiceOn ? 'Mute her voice' : 'Turn her voice on'} aria-pressed={voiceOn} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15">{voiceOn ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15"><X size={20} /></button>
        </header>

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
                        <div className="relative aspect-square bg-raised"><Thumb src={p.image} size={144} /></div>
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
          {msgs.length <= 1 && !busy && (
            <div className="flex flex-wrap gap-2 pt-1">{chips.map((c) => <button key={c} type="button" onClick={() => send(c)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-cream active:bg-raised">{c}</button>)}</div>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); voice.unlock(); send(text); }} className="flex items-center gap-2 border-t border-line bg-surface px-3 py-2.5">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={listening ? 'Boliye, main sun rahi hoon...' : 'Likhein ya bol kar poochein...'} maxLength={300} enterKeyHint="send"
            className="min-w-0 flex-1 rounded-full border border-line bg-raised px-4 py-2.5 text-base outline-none focus:border-gold" aria-label="Message" />
          {micOk && <button type="button" onClick={toggleMic} aria-label={listening ? 'Stop listening' : 'Speak'} aria-pressed={listening} className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${listening ? 'animate-pulse bg-red-600 text-white' : 'bg-raised text-gold'}`}><Mic size={20} /></button>}
          <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold text-white disabled:opacity-40"><Send size={18} /></button>
        </form>
      </div>
    </div>
  );
}
