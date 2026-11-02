import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { IPTV, cleanMac, lineState, planById } from '@/lib/iptv';
import { clientPrice } from '@/lib/iptvReseller';
import { lineActivity, overview } from '@/lib/iptvStats';
import { trackEvent } from '@/lib/gateway/track';
import { logAdmin } from '@/lib/gateway/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });
const DAY = 86400e3;
const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';

// XTREAM USERS (lines) — poora manager: search, har field edit, renew, suspend, delete, password reset.
//   GET  ?q=&limit=          -> lines + har line ki aakhri activity (app/channel/ip) + totals
//   POST { action:'save', id, patch:{...} }
//   POST { action:'renew', id, months } | suspend | resume | delete | resetPassword | note
export async function GET(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: true, demo: true, lines: [], totals: overview({}), resellers: [] });

  const q = new URL(req.url).searchParams;
  const term = String(q.get('q') || '').trim().toLowerCase();
  const limit = Math.min(500, Math.max(20, Number(q.get('limit')) || 300));

  try {
    const db = adminDb();
    const [linesSnap, sessSnap, resSnap] = await Promise.all([
      db.collection('iptvLines').limit(limit).get().catch(() => null),
      db.collection('iptvSessions').limit(600).get().catch(() => null),
      db.collection('iptvResellers').limit(200).get().catch(() => null),
    ]);

    const all = (linesSnap?.docs || []).map((d) => ({ id: d.id, ...d.data() }));
    const sessions = {};
    for (const d of sessSnap?.docs || []) sessions[d.id] = d.data();

    const rows = all
      .filter((l) => {
        if (!term) return true;
        const hay = `${l.username || ''} ${l.clientName || ''} ${l.name || ''} ${l.phone || ''} ${l.mac || ''} ${l.resellerName || ''} ${l.email || ''}`.toLowerCase();
        return hay.includes(term);
      })
      .map((l) => {
        const state = lineState(l.expiresAt);
        return {
          id: l.id,
          username: l.username || '',
          password: l.password || '',
          clientName: l.clientName || l.name || '',
          phone: l.phone || '',
          email: l.email || '',
          mac: l.mac || '',
          device: l.device || (l.mac ? 'mag' : 'xtream'),
          plan: l.plan || 'starter',
          maxDevices: Number(l.maxDevices) || 1,
          price: Number(l.price) || 0,
          months: Number(l.months) || 1,
          status: l.status || 'active',
          trial: Boolean(l.trial),
          note: l.note || '',
          expiresAt: Number(l.expiresAt) || 0,
          createdAt: Number(l.createdAt) || 0,
          state: state.state,
          daysLeft: state.days ?? 0,
          resellerId: l.resellerId || 'admin',
          resellerName: l.resellerName || (l.resellerId && l.resellerId !== 'admin' ? l.resellerId : 'Mizanora'),
          activity: lineActivity(l, sessions),
        };
      })
      .sort((x, y) => Number(y.activity?.lastSeen) - Number(x.activity?.lastSeen) || (y.createdAt || 0) - (x.createdAt || 0));

    const resellers = (resSnap?.docs || []).map((d) => ({ id: d.id, name: d.data().name || d.id, credit: Number(d.data().credit) || 0 }));
    const online = Object.values(sessions);

    return json({
      ok: true,
      lines: rows,
      totals: { ...overview({ lines: all, online }) , shown: rows.length, total: all.length },
      resellers,
      plans: ['starter', 'family', 'premium', 'trial'].map((id) => ({ id, devices: planById(id)?.devices || 1 })),
      cap: IPTV.cap,
    });
  } catch (e) {
    return json({ ok: false, error: e.message || 'Server error' }, 500);
  }
}

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: false, error: 'Firestore connect karein (FIREBASE_SERVICE_ACCOUNT).' }, 503);

  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  const action = String(b.action || 'save');
  const id = String(b.id || '');
  const db = adminDb();

  // ---------------------------------------------------------------- v47: BULK (aik sath kai lines)
  // { action:'bulk', ids:[], mode:'suspend'|'resume'|'delete'|'extend'|'plan', days?, plan? }
  if (action === 'bulk') {
    const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).map((x) => String(x || '').trim()).filter(Boolean))].slice(0, 200);
    if (!ids.length) return json({ ok: false, error: 'Kam az kam aik line chunein.' }, 400);
    const mode = String(b.mode || '');
    if (!['suspend', 'resume', 'delete', 'extend', 'plan'].includes(mode)) return json({ ok: false, error: 'Mode ghalat hai.' }, 400);
    const days = Math.min(365, Math.max(1, Number(b.days) || 30));
    const plan = ['starter', 'family', 'premium', 'trial'].includes(String(b.plan)) ? String(b.plan) : '';

    let done = 0;
    const failed = [];
    for (const lid of ids) {
      try {
        const ref = db.collection('iptvLines').doc(lid);
        const snap = await ref.get();
        if (!snap.exists) { failed.push(lid); continue; }
        const line = snap.data() || {};
        if (mode === 'delete') {
          await ref.delete();
          await db.collection('iptvSessions').doc(line.username || lid).delete().catch(() => {});
        } else if (mode === 'suspend' || mode === 'resume') {
          await ref.update({ status: mode === 'suspend' ? 'suspended' : 'active', statusAt: Date.now(), bulkAt: Date.now() });
        } else if (mode === 'extend') {
          const from = Math.max(Date.now(), Number(line.expiresAt) || 0);
          await ref.update({ expiresAt: from + days * 86400e3, status: 'active', bulkAt: Date.now() });
        } else if (mode === 'plan') {
          if (!plan) { failed.push(lid); continue; }
          await ref.update({ plan, bulkAt: Date.now() });
        }
        done += 1;
      } catch { failed.push(lid); }
    }
    await logAdmin(req, a.uid, `line_bulk_${mode}`, { count: done, ids: ids.slice(0, 20), days, plan });
    trackEvent('admin_bulk', { id: 'bulk', username: `bulk-${mode}` }, req, { count: done, mode });
    return json({ ok: true, mode, done, failed: failed.length, total: ids.length });
  }

  if (!id) return json({ ok: false, error: 'Line id missing.' }, 400);
  const ref = db.collection('iptvLines').doc(id);

  try {
    const snap = await ref.get();
    if (!snap.exists) return json({ ok: false, error: 'Line nahi mili.' }, 404);
    const line = { id, ...snap.data() };

    if (action === 'delete') {
      await ref.delete();
      await db.collection('iptvSessions').doc(line.username || id).delete().catch(() => {});
      await logAdmin(req, a.uid, 'line_delete', { id, username: line.username });
      return json({ ok: true, deleted: true });
    }

    if (action === 'suspend' || action === 'resume') {
      const status = action === 'suspend' ? 'suspended' : 'active';
      await ref.update({ status, statusAt: Date.now() });
      await logAdmin(req, a.uid, `line_${action}`, { id, username: line.username });
      return json({ ok: true, status });
    }

    if (action === 'renew') {
      const months = [1, 3, 6, 12].includes(Number(b.months)) ? Number(b.months) : 1;
      const from = Math.max(Date.now(), Number(line.expiresAt) || 0);
      const d = new Date(from);
      d.setMonth(d.getMonth() + months);
      await ref.update({ expiresAt: d.getTime(), status: 'active', renewedAt: Date.now() });
      await logAdmin(req, a.uid, 'line_renew', { id, username: line.username, months });
      return json({ ok: true, expiresAt: d.getTime(), months });
    }

    if (action === 'resetPassword') {
      let password = '';
      for (let i = 0; i < 8; i++) password += ALPHA[Math.floor(Math.random() * ALPHA.length)];
      await ref.update({ password, passwordChangedAt: Date.now() });
      await logAdmin(req, a.uid, 'line_reset_password', { id, username: line.username });
      return json({ ok: true, username: line.username, password });
    }

    if (action === 'note') {
      await ref.update({ note: String(b.note || '').slice(0, 300) });
      await logAdmin(req, a.uid, 'line_note', { id, username: line.username });
      return json({ ok: true });
    }

    // ---------------------------------------------------------------- full edit
    const p = b.patch && typeof b.patch === 'object' ? b.patch : {};
    const patch = {};

    if (typeof p.clientName === 'string' || typeof p.name === 'string') patch.clientName = String(p.clientName || p.name || '').trim().slice(0, 60);
    if (typeof p.phone === 'string') patch.phone = p.phone.replace(/[^\d+]/g, '').slice(0, 14);
    if (typeof p.email === 'string') patch.email = p.email.trim().toLowerCase().slice(0, 120);
    if (typeof p.note === 'string') patch.note = p.note.slice(0, 300);
    if (p.plan && planById(p.plan)) {
      patch.plan = p.plan;
      if (p.maxDevices === undefined) patch.maxDevices = planById(p.plan).devices;
    }
    if (p.maxDevices !== undefined) patch.maxDevices = Math.min(5, Math.max(1, Number(p.maxDevices) || 1));
    if (p.price !== undefined) patch.price = clientPrice(p.price);
    if (p.status && ['active', 'suspended', 'cancelled', 'trial'].includes(p.status)) patch.status = p.status;
    if (p.mac !== undefined) patch.mac = p.mac ? cleanMac(p.mac) : '';
    if (p.device === 'mag' || p.device === 'xtream') patch.device = p.device;
    if (p.days !== undefined) {
      const days = Math.min(730, Math.max(-365, Number(p.days) || 0));
      const from = Math.max(Date.now(), Number(line.expiresAt) || 0);
      patch.expiresAt = days >= 0 ? from + days * DAY : Math.max(0, (Number(line.expiresAt) || Date.now()) + days * DAY);
    }
    if (p.expiresAt !== undefined) {
      const t = Number(p.expiresAt);
      if (Number.isFinite(t) && t > 0) patch.expiresAt = t;
    }
    if (p.resellerId !== undefined) {
      patch.resellerId = String(p.resellerId || 'admin');
      patch.resellerName = patch.resellerId === 'admin' ? 'Mizanora' : String(p.resellerName || '').slice(0, 40);
    }
    if (p.username !== undefined) {
      const u = String(p.username || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
      if (u.length >= 4) patch.username = u;
    }

    if (!Object.keys(patch).length) return json({ ok: false, error: 'Koi tabdeeli nahi mili.' }, 400);
    patch.updatedAt = Date.now();
    await ref.update(patch);
    trackEvent('line_edited', line, req, { by: 'admin', fields: Object.keys(patch).join(',') }).catch(() => {});
    await logAdmin(req, a.uid, 'line_edit', { id, username: line.username, fields: Object.keys(patch).join(',') });

    return json({ ok: true, patch });
  } catch (e) {
    return json({ ok: false, error: e.message || 'Server error' }, 500);
  }
}
