'use client';
import { useCallback, useEffect, useState } from 'react';
import { authClient } from '@/lib/firebase-client';
import {
  AlertTriangle, Ban, CheckCircle2, History, Loader2, Plus, RefreshCw, ShieldCheck, ShieldOff, Trash2, X,
} from 'lucide-react';
import { accessCounts } from '@/lib/iptvAccess';

// Audit ki ek line (server ka lib/gateway/audit.js firebase-admin import karta hai, is liye yahan local copy)
const auditText = (e = {}) => {
  const who = e.uid ? `admin ${String(e.uid).slice(0, 6)}…` : 'admin';
  return `${who} → ${String(e.action || 'action')}${e.value ? ` · ${e.value}` : e.username ? ` · ${e.username}` : ''}`;
};

// Admin > IPTV > Access rules (blacklist / whitelist).
// Teen tarah ki entry: IP (exact / wildcard / CIDR), username, MAC.
// Blocklist mode: sab chalta hai siwaye block list ke. Allowlist mode: sirf allow list.
const KIND_LABEL = { ip: 'IP', user: 'Username', mac: 'MAC' };
const EMPTY = { mode: 'blocklist', block: { ip: [], user: [], mac: [] }, allow: { ip: [], user: [], mac: [] }, note: '', updatedAt: 0 };

export default function IptvAccessAdmin() {
  const [rules, setRules] = useState(EMPTY);
  const [audit, setAudit] = useState([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [kind, setKind] = useState('ip');
  const [list, setList] = useState('block');
  const [value, setValue] = useState('');
  const [test, setTest] = useState({ ip: '', user: '', mac: '' });
  const [verdict, setVerdict] = useState(null);

  const call = useCallback(async (body, method = 'POST') => {
    const u = authClient().currentUser;
    if (!u) return { ok: false, error: 'Signed out.' };
    const token = await u.getIdToken();
    try {
      const r = await fetch('/api/admin/iptv/access', {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: method === 'GET' ? undefined : JSON.stringify(body),
      });
      return await r.json().catch(() => ({ ok: false, error: `Server ${r.status}` }));
    } catch (e) { return { ok: false, error: e.message }; }
  }, []);

  const load = useCallback(async () => {
    setBusy('load'); setErr('');
    const j = await call(null, 'GET');
    if (j.ok) { setRules(j.rules || EMPTY); setAudit(j.audit || []); } else setErr(j.error || 'Load nahi hua.');
    setBusy('');
  }, [call]);

  useEffect(() => { load(); }, [load]);

  const act = async (body, label) => {
    setBusy(label); setMsg(''); setErr('');
    const j = await call(body);
    if (j.ok) {
      if (j.rules) setRules(j.rules);
      setMsg(`${label} — ho gaya`);
      if (j.verdict) setVerdict(j.verdict);
      setTimeout(() => { load(); }, 500);
    } else setErr(j.error || 'Nahi hua');
    setBusy('');
  };

  const counts = accessCounts(rules);

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold"><ShieldCheck size={16} className="text-gold" /> Access rules — blacklist / whitelist</h2>
          <p className="text-xs text-dim">
            IP (exact, <code>10.0.0.*</code>, <code>10.0.0.0/24</code>), username ya MAG ka MAC. Block sab se pehle lagta hai;
            allowlist mode mein sirf allow list wale chaltay hain. Gateway 20 second mein naye rules uthata hai.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
          <span className="rounded-full border border-red-300 bg-red-50 px-2 py-1 text-red-700">{counts.block} blocked</span>
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-700">{counts.allow} allowed</span>
          <button type="button" className="btn-ghost !px-2 !py-1" onClick={load} disabled={busy === 'load'}>
            {busy === 'load' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Refresh
          </button>
        </div>
      </div>

      {msg && <p className="rounded-xl border border-gold/30 bg-gold/[0.06] px-3 py-2 text-xs font-semibold text-gold">{msg}</p>}
      {err && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{err}</p>}

      {/* mode */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-raised p-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-faint">Mode</span>
        {[['blocklist', 'Blocklist (default)'], ['allowlist', 'Allowlist (sirf listed)']].map(([id, label]) => (
          <button key={id} type="button" onClick={() => act({ action: 'mode', mode: id }, 'Mode')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${rules.mode === id ? 'bg-gold text-black' : 'border border-line text-dim hover:text-cream'}`}>
            {label}
          </button>
        ))}
        {rules.mode === 'allowlist' && counts.allow === 0 && (
          <span className="ml-auto flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
            <AlertTriangle size={11} /> Allowlist khali hai — abhi sab chal raha hai
          </span>
        )}
      </div>

      {/* add */}
      <div className="grid gap-2 sm:grid-cols-[7rem_8rem_1fr_auto]">
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind">
          <option value="ip">IP</option>
          <option value="user">Username</option>
          <option value="mac">MAC</option>
        </select>
        <select className="input" value={list} onChange={(e) => setList(e.target.value)} aria-label="List">
          <option value="block">Block list</option>
          <option value="allow">Allow list</option>
        </select>
        <input className="input" value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) { act({ action: 'add', list, kind, value }, 'Add'); setValue(''); } }}
          placeholder={kind === 'ip' ? '1.2.3.4 · 10.0.0.* · 10.0.0.0/24' : kind === 'mac' ? '00:1A:79:AA:BB:CC' : 'mz123456'} />
<button type="button" className="btn-gold" disabled={!value.trim() || !!busy}
          onClick={async () => { await act({ action: 'add', list, kind, value }, 'Add'); setValue(''); }}>
          <Plus size={14} /> Add
        </button>
      </div>

      {/* lists */}
      <div className="grid gap-2 lg:grid-cols-2">
        {['block', 'allow'].map((side) => (
          <div key={side} className={`rounded-xl border p-2.5 ${side === 'block' ? 'border-red-200 bg-red-50/40' : 'border-emerald-200 bg-emerald-50/40'}`}>
            <div className="mb-1.5 flex items-center justify-between">
              <p className={`flex items-center gap-1.5 text-[11px] font-bold ${side === 'block' ? 'text-red-700' : 'text-emerald-700'}`}>
                {side === 'block' ? <Ban size={12} /> : <CheckCircle2 size={12} />} {side === 'block' ? 'Block' : 'Allow'} list
                <span className="text-[10px] font-normal opacity-70">({counts[side]})</span>
              </p>
              {counts[side] > 0 && (
                <button type="button" className="text-[10px] font-bold text-faint hover:text-red-600"
                  onClick={() => act({ action: 'clear', list: side }, 'Clear')}>
                  <Trash2 size={11} className="inline" /> clear
                </button>
              )}
            </div>
            {['ip', 'user', 'mac'].map((k) => (
              rules[side][k].length ? (
                <div key={k} className="mb-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-faint">{KIND_LABEL[k]}</p>
                  <div className="flex flex-wrap gap-1">
                    {rules[side][k].map((v) => (
                      <span key={v} className="inline-flex items-center gap-1 rounded-full border border-line bg-white/70 px-2 py-0.5 font-mono text-[10px] text-cream">
                        {v}
                        <button type="button" onClick={() => act({ action: 'remove', list: side, kind: k, value: v }, 'Remove')}
                          className="text-faint hover:text-red-600" aria-label={`remove ${v}`}><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null
            ))}
            {!counts[side] && <p className="text-[10px] text-faint">Khali — koi entry nahi.</p>}
          </div>
        ))}
      </div>

      {/* tester */}
      <div className="rounded-xl border border-line bg-raised p-2.5">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-cream"><ShieldOff size={12} className="text-gold" /> Check karein — yeh client chalta hai ya nahi?</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input className="input" value={test.ip} onChange={(e) => setTest((t) => ({ ...t, ip: e.target.value }))} placeholder="IP" />
          <input className="input" value={test.user} onChange={(e) => setTest((t) => ({ ...t, user: e.target.value }))} placeholder="Username" />
          <input className="input" value={test.mac} onChange={(e) => setTest((t) => ({ ...t, mac: e.target.value }))} placeholder="MAC" />
          <button type="button" className="btn-ghost" onClick={() => act({ action: 'test', ...test }, 'Test')} disabled={!!busy}>Test</button>
        </div>
        {verdict && (
          <p className={`mt-2 rounded-lg border px-2 py-1.5 text-[11px] font-bold ${verdict.blocked ? 'border-red-300 bg-red-50 text-red-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
            {verdict.blocked ? `BLOCKED — ${verdict.reason}` : 'ALLOWED — yeh client chal jayega'}
          </p>
        )}
      </div>

      {/* audit */}
      <div>
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-cream"><History size={12} className="text-gold" /> Aakhri admin actions</p>
        {audit.length ? (
          <ul className="max-h-52 space-y-0.5 overflow-y-auto">
            {audit.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-line/60 px-2 py-1 text-[10.5px] text-dim">
                <span className="truncate">{auditText(e)}</span>
                <span className="shrink-0 font-mono text-[9.5px] text-faint">{e.at ? new Date(e.at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-[10px] text-faint">Abhi koi action log nahi (ya Firestore off hai).</p>}
      </div>
    </section>
  );
}
