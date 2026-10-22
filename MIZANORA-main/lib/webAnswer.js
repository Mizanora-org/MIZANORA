import { geminiCall, ladderFor, textOf } from './gemini';

// v23: lets the shop assistant answer questions outside the shop (general knowledge, Islamic questions, news, how-to) from a Google
// search, honestly and in the shop's values. It is a TOOL the assistant calls; the assistant itself stays short and polite.
//  - answers only from what the search finds, says clearly when it is not sure, never invents an ayah, hadith, reference or number
//  - Islamic questions: only well-established answers with their source (Quran surah:ayah, hadith book and number); where scholars
//    differ it says so and tells the person to ask a qualified aalim; no fatwas, no sectarian attacks
//  - refuses haram help: riba (interest), gambling, fraud, cheating, adult content, hurting anyone
const RULES = `You answer for a Pakistani Muslim online shop. Be honest, respectful and accurate.
- Use ONLY what you find with search. If you are not sure or the sources disagree, say so plainly.
- Never invent an ayah, hadith, reference, statistic, price or news. Give the source when you state a fact.
- Islamic questions: state only well-established answers with their source (surah:ayah, or hadith book and number). If scholars differ, say that and advise asking a qualified aalim. Do not issue a fatwa. Never attack any sect or person.
- Do not help with interest (riba), gambling, fraud, cheating, adult content or harming anyone: say politely it is not allowed and offer a halal alternative.
- Answer in the language of the question (Roman Urdu for Roman Urdu), simple words, no markdown.`;

export async function webAnswer(cfg, question, { words = 90, timeoutMs = 12000 } = {}) {
  const q = String(question || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  if (!q) return { ok: false, error: 'empty question' };
  const r = await geminiCall(ladderFor(cfg, 'fast'), {
    systemInstruction: { parts: [{ text: RULES }] },
    contents: [{ role: 'user', parts: [{ text: `Question: ${q}\nAnswer in at most ${words} words.` }] }],
    tools: [{ google_search: {} }], generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
  }, { timeoutMs, deadlineMs: timeoutMs + 6000, maxTries: 2 });
  if (!r.ok) return { ok: false, error: `search unavailable (${r.status})` };
  const gm = r.json.candidates && r.json.candidates[0] && r.json.candidates[0].groundingMetadata;
  const sources = ((gm && gm.groundingChunks) || []).map((c) => c.web && { title: String(c.web.title || '').slice(0, 60), url: c.web.uri }).filter(Boolean).slice(0, 4);
  const answer = textOf(r.json).replace(/[*_#`]+/g, '').trim().slice(0, 900);
  return answer ? { ok: true, answer, sources } : { ok: false, error: 'no answer found' };
}
