'use client';
import { useCallback, useEffect, useState } from 'react';
import { authClient } from '@/lib/firebase-client';
import { Ban, CheckCircle2, Copy, KeyRound, Loader2, Pencil, PlayCircle, RefreshCw, Search, Trash2, Users, X } from 'lucide-react';

// Admin > IPTV > Xtream users (lines). Search, har field edit, renew, suspend, password reset, delete.
// Har line ke saath aakhri device/app/channel bhi dikhta hai (iptvSessions se).
const ago = (t) => {
  if (!t) return '—';
  const s = Math.max(0, Math.round((Date.now() - Number(t)) / 1000));
  if (s < 60) return `${s}s pehle`;
  if (s < 3600) return `${Math.round(s / 60)}m pehle`;
  if (s < 86400) return `${Math.round(s / 3600)}h pehle`;
  return `${Math.round(s / 86400)}d pehle`;
};
const date = (t) => (t ? new Date(Number(t)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');

const badge = (l) => {
  if (l.status === 'suspended') return 'border-red-200 bg-red-50 text-red-700';
  if (l.status === 'cancelled') return 'border-line bg-raised text-faint';
  if (l.state === 'expired') return 'border-red-200 bg-red-50 text-red-700';
  if (l.state === 'expiring') return 'border-amber-300 bg-amber-50 text-amber-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
};

export default function IptvLinesAdmin() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const [sel, setSel] = useState([]);        // v47: bulk ke liye chuni hui lines

  const call = useCallback(async (body, method = 'POST') => {
    const u = authClient().currentUser;
    if (!u) return { ok: false, error: 'Signed out.' };
    const token = await u.getIdToken();
    try {
      const r = await fetch(`/api/admin/iptv/lines${method === 'GET' && body ? `?q=${encodeURIComponent(body.q || '')}` : ''}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: method === 'GET' ? undefined : JSON.stringify(body),
      });
      return await r.json().catch(() => ({ ok: false, error: `Server ${r.status}` }));
    } catch (e) { return { ok: false, error: e.message }; }
  }, []);

  const toggleSel = (id) => setSel((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const bulk = async (mode, extra = {}) => {
    if (!sel.length) return;
    if (mode === 'delete' && !window.confirm(`${sel.length} lines delete karni hain? Yeh wapas nahi aayengi.`)) return;
    setBusy(`bulk-${mode}`); setMsg(''); setErr('');
    const j = await call({ action: 'bulk', ids: sel, mode, ...extra });
    setMsg(j.ok ? `${mode}: ${j.done}/${j.total} lines ho gayi${j.failed ? ` · ${j.failed} fail` : ''}` : (j.error || 'Bulk nahi hua.'));
    setBusy('');
    if (j.ok) { setSel([]); setTimeout(() => load(q), 500); }
  };

  const load = useCallback(async (term = q) => {
    setBusy('load'); setErr('');
    const j = await call({ q: term }, 'GET');
    if (j.ok) setData(j); else setErr(j.error || 'Load nahi hua.');
    setBusy('');
  }, [call, q]);

  useEffect(() => { load(''); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function act(action, line, extra = {}) {
    if (action === 'delete' && !confirm(`${line.username} ko hamesha ke liye delete karein?`)) return;
    setBusy(`${action}:${line.id}`); setMsg(''); setErr('');
    const j = await call({ action, id: line.id, ...extra });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Nahi hua.'); return; }
    if (action === 'resetPassword') setMsg(`${line.username} ka naya password: ${j.password}`);
    else setMsg('Ho gaya.');
    load(q);
  }

  function openEdit(line) {
    setEdit(line);
    setForm({
      clientName: line.clientName, phone: line.phone, email: line.email, username: line.username,
      plan: line.plan, maxDevices: line.maxDevices, price: line.price, mac: line.mac,
      device: line.device, days: line.daysLeft, note: line.note, status: line.status,
      resellerId: line.resellerId,
    });
  }

  async function saveEdit() {
    setBusy('save'); setMsg(''); setErr('');
    const j = await call({ action: 'save', id: edit.id, patch: { ...form, days: Number(form.days) || 0 } });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Save nahi hua.'); return; }
    setMsg(`${form.username} update ho gaya.`);
    setEdit(null);
    load(q);
  }

  const t = data?.totals || {};
  const lines = data?.lines || [];

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold"><Users size={16} className="text-gold" /> Xtream users / lines</h2>
          <p className="text-xs text-dim">Har line ka poora control — plan, device, price, MAC, expiry, password. Aakhri app/channel bhi yahin.</p>
        </div>
        <span className="rounded-full border border-line bg-raised px-2.5 py-1 text-[11px] font-bold text-dim">
          {t.total || lines.length} lines · {t.online || 0} online · {t.expiring || 0} expiring
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(q); }}
          placeholder="Search — username, client, phone, MAC, reseller" />
        <button type="button" className="btn-ghost" onClick={() => load(q)} disabled={busy === 'load'}>
          {busy === 'load' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Search
        </button>
        <button type="button" className="btn-ghost" onClick={() => { setQ(''); load(''); }}><RefreshCw size={14} /> All</button>
      </div>

      {msg && <p className="rounded-xl border border-gold/30 bg-gold/[0.06] px-3 py-2 text-xs font-semibold text-gold">{msg}</p>}
      {err && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{err}</p>}

      {sel.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gold/40 bg-gold/[0.07] px-2.5 py-2 text-[11px] font-bold">
          <span className="text-gold">{sel.length} selected</span>
          <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => bulk('extend', { days: 30 })} disabled={!!busy}>
            {busy === 'bulk-extend' ? <Loader2 size={11} className="animate-spin" /> : null} +30 din
          </button>
          <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => bulk('extend', { days: 7 })} disabled={!!busy}>+7 din</button>
          <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => bulk('suspend')} disabled={!!busy}>Suspend</button>
          <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => bulk('resume')} disabled={!!busy}>Resume</button>
          <button type="button" className="btn-ghost !px-2 !py-1 text-red-600" onClick={() => bulk('delete')} disabled={!!busy}>Delete</button>
          <button type="button" className="ml-auto text-faint hover:text-cream" onClick={() => setSel([])}>clear</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-faint">
            <tr>
              <th className="py-1">
                <input type="checkbox" aria-label="Select all"
                  checked={lines.length > 0 && sel.length === Math.min(60, lines.length)}
                  onChange={(e) => setSel(e.target.checked ? lines.slice(0, 60).map((l) => l.id) : [])} />
              </th>
              <th className="py-1">Line</th><th>Client</th><th>Plan</th><th>Dev</th><th>Price</th><th>Expiry</th><th>Last device</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {lines.slice(0, 60).map((l) => (
              <tr key={l.id} className={`border-t border-line/60 ${sel.includes(l.id) ? 'bg-gold/[0.05]' : ''}`}>
                <td className="py-1.5">
                  <input type="checkbox" aria-label={`select ${l.username}`} checked={sel.includes(l.id)} onChange={() => toggleSel(l.id)} />
                </td>
                <td className="py-1.5">
                  <p className="font-mono text-xs font-semibold text-cream">{l.username}</p>
                  <p className="font-mono text-[10px] text-faint">{l.mac || l.password}</p>
                </td>
                <td className="text-xs text-dim">
                  <p className="max-w-[9rem] truncate text-cream">{l.clientName || '—'}</p>
                  <p className="text-[10px] text-faint">{l.resellerName}</p>
                </td>
                <td className="text-xs text-dim">{l.plan}</td>
                <td className="text-xs tabular-nums text-dim">{l.maxDevices}</td>
                <td className="text-xs tabular-nums text-dim">{l.price || 0}</td>
                <td className="text-xs tabular-nums text-dim">{date(l.expiresAt)}<span className="ml-1 text-[10px] text-faint">{l.state === 'expired' ? '✕' : `${l.daysLeft}d`}</span></td>
                <td className="text-xs text-dim">
                  {l.activity?.online ? <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
                  <span className="text-cream">{l.activity?.app || '—'}</span>
                  <span className="block max-w-[9rem] truncate text-[10px] text-faint">{l.activity?.channel || ago(l.activity?.lastSeen)}</span>
                </td>
                <td><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge(l)}`}>{l.status === 'suspended' ? 'suspended' : l.state}</span></td>
                <td className="text-right whitespace-nowrap">
                  <button type="button" className="btn-ghost !px-2 !py-1 text-[11px]" onClick={() => openEdit(l)} title="Edit"><Pencil size={12} /></button>
                  <button type="button" className="btn-ghost !px-2 !py-1 text-[11px]" onClick={() => act('renew', l, { months: 1 })} title="Renew 1 month"><PlayCircle size={12} /></button>
                  <button type="button" className="btn-ghost !px-2 !py-1 text-[11px]" onClick={() => act('resetPassword', l)} title="New password"><KeyRound size={12} /></button>
                  <button type="button" className="btn-ghost !px-2 !py-1 text-[11px]" onClick={() => act(l.status === 'suspended' ? 'resume' : 'suspend', l)} title="Suspend/Resume">
                    {l.status === 'suspended' ? <CheckCircle2 size={12} /> : <Ban size={12} />}
                  </button>
                  <button type="button" className="ml-1 text-faint hover:text-red-600" onClick={() => act('delete', l)} title="Delete"><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
            {!lines.length && <tr><td colSpan={10} className="py-3 text-xs text-faint">Koi line nahi mili. Search khali karein ya reseller se line banwayein.</td></tr>}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="rounded-xl border border-gold/30 bg-raised p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-display text-sm font-bold text-cream">{edit.username} — edit</p>
            <button type="button" className="text-faint hover:text-cream" onClick={() => setEdit(null)} aria-label="Close"><X size={14} /></button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ['clientName', 'Client name'], ['phone', 'Phone'], ['email', 'Email'],
              ['username', 'Username'], ['price', 'Price (Rs)'], ['maxDevices', 'Devices'],
              ['mac', 'MAC (00:1A:79:..)'], ['days', 'Din (expiry se)'], ['note', 'Note'],
            ].map(([k, label]) => (
              <label key={k} className="text-[11px] text-faint">
                {label}
                <input className="input mt-1" value={form[k] ?? ''} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
              </label>
            ))}
            <label className="text-[11px] text-faint">
              Plan
              <select className="input mt-1" value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}>
                {(data?.plans || [{ id: 'starter' }, { id: 'family' }, { id: 'premium' }, { id: 'trial' }]).map((p) => <option key={p.id} value={p.id}>{p.id}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-faint">
              Device type
              <select className="input mt-1" value={form.device} onChange={(e) => setForm((f) => ({ ...f, device: e.target.value }))}>
                <option value="xtream">Xtream (user/pass)</option>
                <option value="mag">MAG (MAC)</option>
              </select>
            </label>
            <label className="text-[11px] text-faint">
              Status
              <select className="input mt-1" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {['active', 'suspended', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-gold" onClick={saveEdit} disabled={busy === 'save'}>
              {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : null} Save changes
            </button>
            <button type="button" className="btn-ghost" onClick={() => { navigator.clipboard.writeText(`${edit.username} / ${edit.password}`); setMsg('Login copy ho gaya.'); }}>
              <Copy size={14} /> Copy login
            </button>
            <button type="button" className="btn-ghost" onClick={() => act('renew', edit, { months: Number(form.days) > 0 ? 0 : 1 })}>+1 month</button>
          </div>
        </div>
      )}
    </section>
  );
}
