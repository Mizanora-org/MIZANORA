import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { getAccessRules, changeAccessRules, saveAccessRules } from '@/lib/gateway/access';
import { accessCounts, accessVerdict, cleanAccess, normalizeEntry, ACCESS_KINDS } from '@/lib/iptvAccess';
import { logAdmin, recentAudit } from '@/lib/gateway/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

// v47: admin blacklist / whitelist.
//   GET  /api/admin/iptv/access          -> rules + counts + recent audit
//   POST { action:'add'|'remove'|'removeAnywhere'|'mode'|'clear'|'note'|'test'|'replace', ... }
//
// IP exact, wildcard (10.0.0.*) ya CIDR (10.0.0.0/24) ho sakta hai. Username aur MAC bhi.
export async function GET(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);

  const rules = await getAccessRules(true).catch(() => null);
  if (!rules) return json({ ok: false, error: 'Access rules padhi nahi gayi — Firestore check karein.' }, 503);
  const audit = await recentAudit(40);
  return json({ ok: true, rules, counts: accessCounts(rules), audit, kinds: ACCESS_KINDS });
}

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);

  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  const action = String(b.action || 'test');

  if (action === 'test') {
    const rules = await getAccessRules(true);
    const subject = { ip: b.ip || '', user: b.user || '', mac: b.mac || '' };
    return json({ ok: true, verdict: accessVerdict(rules, subject), rules: cleanAccess(rules), counts: accessCounts(rules) });
  }

  if (action === 'replace') {
    const saved = await saveAccessRules(b.rules || {});
    if (!saved.ok) return json(saved, 503);
    await logAdmin(req, a.uid, 'access_replace', { block: accessCounts(saved.rules).block, allow: accessCounts(saved.rules).allow });
    return json({ ok: true, rules: saved.rules, counts: accessCounts(saved.rules) });
  }

  if (!['add', 'remove', 'removeAnywhere', 'mode', 'clear', 'note'].includes(action)) {
    return json({ ok: false, error: 'Unknown action' }, 400);
  }

  // Value ka normal roop — UI ko wohi dikhana chahiye jo save hua
  const value = action === 'add' || action === 'remove' || action === 'removeAnywhere'
    ? normalizeEntry(String(b.kind || ''), b.value)
    : '';
  if ((action === 'add' || action === 'remove' || action === 'removeAnywhere') && !value) {
    return json({ ok: false, error: 'Sahi value daalein (IP / username / MAC)' }, 400);
  }

  const saved = await changeAccessRules({
    action,
    list: b.list,
    kind: b.kind,
    value,
    mode: b.mode,
    note: b.note,
  });
  if (!saved.ok) return json({ ok: false, error: saved.error || 'Save nahi hua' }, 400);

  await logAdmin(req, a.uid, `access_${action}`, {
    list: b.list || '', kind: b.kind || '', value,
    mode: b.mode || '',
  });
  return json({ ok: true, rules: saved.rules, counts: accessCounts(saved.rules) });
}
