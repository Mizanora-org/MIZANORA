// The assistant's voice (runs in the browser).
//  - "browser" mode: the phone's own text-to-speech, choosing a female voice (free, instant, no limits)
//  - "gemini" mode: natural female voice made by Gemini on the server (/api/assistant/tts); falls back to the browser voice
//
// v16 fixes:
//  - voices are read when the browser has them (Chrome loads them late: the old code often spoke with the wrong voice)
//  - long answers are split into sentences: Chrome silently stops speech after about 15 seconds, which left the assistant
//    "speaking" forever and the microphone never came back
//  - a keep-alive (pause + resume) keeps long sentences going on desktop only: on Android, pause() cancels the speech,
//    so there the short pieces alone do the job. Every wait has a timeout, so the conversation can never freeze.
const FEMALE = /female|woman|zira|uzma|salma|swara|heera|neerja|kalpana|veena|aditi|priya|hazel|susan|samantha|karen|moira|tessa|aria|jenny|sonia|libby|natasha|google (हिन्दी|hindi|uk english female|us english)/i;
const MALE = /\bmale\b|ravi|hemant|prabhat|madhur|rishi|david|mark|george|guy|ryan|james|asad|daniel|alex|fred/i;
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const URDU = /[\u0600-\u06FF]/;
const ANDROID = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '');

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

export function createVoice(getMode) {
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
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

  // One short piece. Always resolves (end, error, or timeout), never hangs.
  const browserSpeakOne = (text) => new Promise((res) => {
    if (!synth) { res(); return; }
    let done = false;
    let keep = null;
    let t = null;
    const fin = () => {
      if (done) return;
      done = true;
      clearInterval(keep); clearTimeout(t);
      if (pending === fin) pending = null;
      res();
    };
    try {
      const u = new SpeechSynthesisUtterance(text);
      const v = pick(text);
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = URDU.test(text) ? 'ur-PK' : 'en-IN';
      u.rate = 1; u.pitch = 1.1; u.volume = 1;
      u.onend = fin; u.onerror = fin;
      pending = fin;
      t = setTimeout(fin, 4000 + text.length * 120);
      // Chrome on desktop cancels speech after about 15 seconds: a small pause/resume keeps it going (not on Android).
      if (!ANDROID) keep = setInterval(() => { try { if (synth.speaking) { synth.pause(); synth.resume(); } } catch (_) { /* ignore */ } }, 5000);
      synth.speak(u);
    } catch (_) { fin(); }
  });

  const browserSpeak = async (text, mine) => {
    for (const part of speechChunks(text)) {
      if (mine !== gen) return;
      await browserSpeakOne(part);
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
    isSpeaking() {
      return Boolean((synth && synth.speaking) || (audio && !audio.paused && !audio.ended && audio.currentTime > 0));
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
