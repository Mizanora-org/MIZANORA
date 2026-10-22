import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { geminiCall, ladderFor, loadAssistant } from '@/lib/gemini';
import { RISKY, TOOLS, describeRisky, managerPrompt, runTool } from '@/lib/aiManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

const hits = new Map();
const tooFast = (uid) => { const now = Date.now(); const a = (hits.get(uid) || []).filter((t) => now - t < 60000); a.push(now); hits.set(uid, a); return a.length > 30; };
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);

// Tasks and the latest actions, for the side panel.
export async function GET(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: false, error: 'Firebase Admin is not set up (FIREBASE_SERVICE_ACCOUNT).' }, 503);
  try {
    const [t, l] = await Promise.all([
      adminDb().collection('aiManagerTasks').where('done', '==', false).limit(30).get(),
      adminDb().collection('aiManagerLog').orderBy('atMs', 'desc').limit(12).get(),
    ]);
    return json({ ok: true, tasks: t.docs.map((d) => ({ id: d.id, title: d.data().title, notes: d.data().notes || '', due: d.data().due || '' })), log: l.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (e) { return json({ ok: false, error: clip(e.message, 160) }, 500); }
}

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: false, error: 'Firebase Admin is not set up (FIREBASE_SERVICE_ACCOUNT). The AI manager needs it to make changes.' }, 503);
  if (tooFast(a.uid || 'admin')) return json({ ok: false, error: 'Too many requests. Please wait a minute.' }, 429);
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'Invalid request' }, 400); }

  // The admin pressed Confirm on a prepared action: run exactly that one action (no AI involved).
  if (b.confirm) {
    const tool = String(b.confirm.tool || '');
    if (!RISKY.has(tool)) return json({ ok: false, error: 'This action does not need confirmation.' }, 400);
    const r = await runTool(tool, b.confirm.args || {}, { uid: a.uid });
    return json({ ok: true, text: r.ok === false ? `Could not do it: ${r.error}` : r.summary, done: r.ok !== false, actions: [{ tool, ok: r.ok !== false, summary: r.summary || r.error }] });
  }

  const msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-14).map((m) => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: clip(m.text, 6000) || '.' }] }));
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return json({ ok: false, error: 'Write a message first.' }, 400);

  const { cfg } = await loadAssistant();
  const ladder = ladderFor({ ...cfg, speed: 'smart' }, 'chat');
  const contents = msgs;
  const actions = [];
  const pending = [];
  let text = '';
  try {
    for (let step = 0; step < 10; step++) {
      const r = await geminiCall(ladder, {
        systemInstruction: { parts: [{ text: managerPrompt() }] },
        contents, tools: TOOLS, generationConfig: { temperature: 0.4, maxOutputTokens: 8000 },
      }, { timeoutMs: 30000, deadlineMs: 55000, maxTries: 4 });
      if (!r.ok) return json({ ok: false, error: r.status === 429 ? 'The AI is resting (free limit). Try again in a minute, or add another key in Admin > AI Assistant.' : `The AI could not answer (${r.status}).` });
      const content = r.json.candidates && r.json.candidates[0] && r.json.candidates[0].content;
      const parts = (content && content.parts) || [];
      const calls = parts.filter((p) => p.functionCall);
      if (!calls.length) { text = parts.map((p) => p.text || '').join('').trim(); break; }
      contents.push(content);
      const out = [];
      for (const c of calls.slice(0, 4)) {
        const name = c.functionCall.name;
        const args = c.functionCall.args || {};
        let response;
        if (RISKY.has(name)) {
          const d = await describeRisky(name, args);
          if (d.error) response = { ok: false, error: d.error };
          else { pending.push({ tool: name, args, summary: d.summary }); response = { ok: true, status: 'prepared_waiting_for_admin_confirmation' }; }
        } else {
          const res = await runTool(name, args, { uid: a.uid });
          actions.push({ tool: name, ok: res.ok !== false, summary: res.summary || res.error || '' });
          response = res.ok === false ? { ok: false, error: res.error } : { ok: true, summary: res.summary, data: res.data };
        }
        let safe;
        try { safe = JSON.parse(JSON.stringify(response).slice(0, 18000)); } catch { safe = { ok: response.ok !== false, summary: clip(response.summary || response.error, 300) }; } // too long to cut as JSON: keep the short part
        out.push({ functionResponse: { name, response: safe } });
      }
      contents.push({ role: 'user', parts: out });
    }
  } catch (e) { return json({ ok: false, error: clip(e.message, 160) }, 500); }
  if (!text) text = pending.length ? 'Maine ye tayyar kar diya hai. Neeche Confirm dabayein.' : actions.length ? actions.map((x) => x.summary).join(' ') : 'Samajh nahi aaya, dobara likhein.';
  return json({ ok: true, text, actions, pending });
}
