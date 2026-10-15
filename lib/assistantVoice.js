// The assistant's voice (runs in the browser).
//  - "browser" mode: the phone's own text-to-speech, choosing a female voice (free, instant, no limits)
//  - "gemini" mode: natural female voice made by Gemini on the server (/api/assistant/tts); falls back to the browser voice
const FEMALE = /female|woman|zira|uzma|salma|swara|heera|neerja|kalpana|veena|aditi|priya|hazel|susan|samantha|karen|moira|tessa|aria|jenny|sonia|libby|natasha|google (हिन्दी|hindi|uk english female|us english)/i;
const MALE = /\bmale\b|ravi|hemant|prabhat|madhur|rishi|david|mark|george|guy|ryan|james|asad|daniel|alex|fred/i;
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

export function createVoice(getMode) {
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  let audio = null;
  let gen = 0;
  let pending = null;

  const pick = (text) => {
    if (!synth) return null;
    const vs = synth.getVoices();
    if (!vs.length) return null;
    const urdu = /[\u0600-\u06FF]/.test(text);
    const order = urdu ? ['ur', 'hi', 'en-in'] : ['en-in', 'hi', 'en-gb', 'en-us', 'en'];
    const of = (l) => vs.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(l));
    for (const l of order) { const f = of(l).find((v) => FEMALE.test(v.name) && !MALE.test(v.name)); if (f) return f; }
    for (const l of order) { const f = of(l).find((v) => !MALE.test(v.name)); if (f) return f; }
    return null;
  };

  const browserSpeak = (text) => new Promise((res) => {
    if (!synth) { res(); return; }
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = pick(text);
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = /[\u0600-\u06FF]/.test(text) ? 'ur-PK' : 'en-IN';
      u.rate = 1; u.pitch = 1.12;
      let done = false;
      const fin = () => { if (!done) { done = true; clearTimeout(t); pending = null; res(); } };
      const t = setTimeout(fin, 4000 + text.length * 95);
      u.onend = fin; u.onerror = fin;
      pending = fin;
      synth.speak(u);
    } catch (_) { res(); }
  });

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
      try { if (!audio) { audio = new Audio(); audio.src = SILENT; audio.play().catch(() => {}); } } catch (_) { /* ignore */ }
      try { if (synth) { synth.getVoices(); const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } } catch (_) { /* ignore */ }
    },
    stop() {
      gen += 1;
      try { if (synth) synth.cancel(); } catch (_) { /* ignore */ }
      try { if (audio) audio.pause(); } catch (_) { /* ignore */ }
      if (pending) { const p = pending; pending = null; p(); }
    },
    async speak(text) {
      const clean = String(text || '').replace(/\s+/g, ' ').trim();
      if (!clean) return;
      this.stop();
      const mine = gen;
      if (getMode() === 'gemini' && audio) {
        try { await geminiSpeak(clean); return; } catch (_) { if (mine !== gen) return; }
      }
      if (mine === gen) await browserSpeak(clean);
    },
  };
}
