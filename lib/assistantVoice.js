// The assistant's voice (runs in the browser).
//  - "browser" mode: the phone's own text-to-speech, choosing a female voice (free, instant, no limits)
//  - "gemini" mode: natural female voice made by Gemini on the server (/api/assistant/tts); falls back to the browser voice
//
// v17 fixes (she did not speak back in some phones / Chrome versions):
//  - the old "pause/resume" keep-alive is REMOVED: on several Chrome and Android versions it silently stopped the speech.
//    Answers are spoken in short pieces (about 150 characters), which Chrome never cuts off.
//  - a short gap after cancel() before speak(): Chrome drops a speech that starts right after cancel().
//  - a watchdog: if the phone does not START the speech within 2.5 seconds, it tries again with the default voice,
//    so she never stays silent because one voice is missing.
//  - isBusy() tells the microphone to wait while she is speaking, and isEcho() drops her own voice if the mic hears it.
//  - voices are read when the browser has them (Chrome loads them late).
const FEMALE = /female|woman|zira|uzma|salma|swara|heera|neerja|kalpana|veena|aditi|priya|hazel|susan|samantha|karen|moira|tessa|aria|jenny|sonia|libby|natasha|google (हिन्दी|hindi|uk english female|us english)/i;
const MALE = /\bmale\b|ravi|hemant|prabhat|madhur|rishi|david|mark|george|guy|ryan|james|asad|daniel|alex|fred/i;
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const URDU = /[\u0600-\u06FF]/;

// Split into short pieces at sentence ends (Latin, Urdu and Devanagari full stops and question marks).
export function speechChunks(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return [];
  const parts = s.match(/[^.!?؟۔।]+[.!?؟۔।]*/g) || [s];
  const out = [];
  let cur = '';
  for (const p of parts) {
    const piece = p.trim();
    if (!piece) continue;
    if ((cur + ' ' + piece).trim().length > 150 && cur) { out.push(cur.trim()); cur = piece; }
    else cur = `${cur} ${piece}`;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const words = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 1);

// True when what the microphone heard is (mostly) the assistant's own last answer: the speaker's voice, not the shopper's.
export function isEcho(heard, spoken) {
  const h = words(heard);
  const sp = new Set(words(spoken));
  if (h.length < 2 || !sp.size) return false;
  const hits = h.filter((w) => sp.has(w)).length;
  return hits / h.length >= 0.6;
}

export function createVoice(getMode) {
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  const ANDROID = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '');
  let audio = null;
  let gen = 0;
  let pending = null;
  let voices = [];
  const loadVoices = () => { try { if (synth) voices = synth.getVoices() || []; } catch (_) { voices = []; } };
  if (synth) {
    loadVoices();
    try { synth.addEventListener('voiceschanged', loadVoices); } catch (_) { synth.onvoiceschanged = loadVoices; }
  }

  const pick = (text) => {
    if (!voices.length) return null;
    const urdu = URDU.test(text);
    const order = urdu ? ['ur', 'hi', 'en-in'] : ['en-in', 'hi', 'en-gb', 'en-us', 'en'];
    const of = (l) => voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(l));
    for (const l of order) { const f = of(l).find((v) => FEMALE.test(v.name) && !MALE.test(v.name)); if (f) return f; }
    for (const l of order) { const f = of(l).find((v) => !MALE.test(v.name)); if (f) return f; }
    return null;
  };

  // One short piece. Always resolves (end, error, watchdog or timeout), never hangs.
  const browserSpeakOne = (text, mine) => new Promise((res) => {
    if (!synth) { res(); return; }
    let done = false;
    let started = false;
    let t = null;
    let watchdog = null;
    const fin = () => {
      if (done) return;
      done = true;
      clearTimeout(t); clearTimeout(watchdog);
      if (pending === fin) pending = null;
      res();
    };
    const speakWith = (useVoice) => {
      if (done || mine !== gen) { fin(); return; }
      clearTimeout(watchdog);
      const u = new SpeechSynthesisUtterance(text);
      const v = useVoice ? pick(text) : null;
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = URDU.test(text) ? 'ur-PK' : 'en-IN';
      u.rate = 1; u.pitch = 1.1; u.volume = 1;
      u.onstart = () => { started = true; };
      u.onend = () => fin();
      u.onerror = () => { if (!started && useVoice && !done) speakWith(false); else fin(); };
      try { synth.speak(u); } catch (_) { fin(); return; }
      watchdog = setTimeout(() => {
        if (started || done) return;
        if (useVoice) { try { synth.cancel(); } catch (_) { /* ignore */ } speakWith(false); } else fin();
      }, 2500);
    };
    t = setTimeout(fin, 4000 + text.length * 120);
    pending = fin;
    try { synth.cancel(); } catch (_) { /* ignore */ }
    // Chrome drops a speech that starts in the same moment as cancel(): wait a moment first.
    setTimeout(() => speakWith(true), 90);
  });

  const browserSpeak = async (text, mine) => {
    for (const part of speechChunks(text)) {
      if (mine !== gen) return;
      await browserSpeakOne(part, mine);
    }
  };

  const geminiSpeak = async (text) => {
    const r = await fetch('/api/assistant/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!r.ok) throw new Error('tts');
    const url = URL.createObjectURL(await r.blob());
    return new Promise((res, rej) => {
      const fin = () => { URL.revokeObjectURL(url); pending = null; res(); };
      pending = fin;
      audio.src = url; audio.onended = fin; audio.onerror = () => { URL.revokeObjectURL(url); pending = null; rej(new Error('play')); };
      audio.play().catch((e) => { URL.revokeObjectURL(url); pending = null; rej(e); });
    });
  };

  return {
    // Call inside a tap/click: browsers only allow sound after the person touched the page.
    unlock() {
      try { if (!audio && typeof Audio !== 'undefined') { audio = new Audio(); audio.src = SILENT; audio.play().catch(() => {}); } } catch (_) { /* ignore */ }
      try { if (synth) { loadVoices(); const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } } catch (_) { /* ignore */ }
    },
    stop() {
      gen += 1;
      try { if (synth) synth.cancel(); } catch (_) { /* ignore */ }
      try { if (audio) audio.pause(); } catch (_) { /* ignore */ }
      if (pending) { const p = pending; pending = null; p(); }
    },
    // True while she is talking (the microphone must wait).
    isBusy() {
      return Boolean(pending) || Boolean(synth && synth.speaking) || Boolean(audio && !audio.paused && !audio.ended && audio.currentTime > 0);
    },
    async speak(text) {
      const clean = String(text || '').replace(/\s+/g, ' ').trim();
      if (!clean) return;
      this.stop();
      const mine = gen;
      if (getMode() === 'gemini' && audio) {
        try { await geminiSpeak(clean); return; } catch (_) { if (mine !== gen) return; }
      }
      if (mine === gen) await browserSpeak(clean, mine);
    },
  };
}
