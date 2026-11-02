'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckSquare, DownloadCloud, Loader2, Plus, Save, Search, Square, Trash2, Tv } from 'lucide-react';
import { authClient } from '@/lib/firebase-client';

// Admin > IPTV > Channels — BULK manage: search, select, group badlo, off/on, delete, manual add.
// 5,000+ channels bhi theek: table paginated hai, select-all sirf filtered rows par lagta hai.
const PAGE = 40;

export default function IptvCatalogueAdmin() {
  const [state, setState] = useState({ loading: true, channels: [], enabled: false, stats: null, shards: null });
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState(() => new Set());
  const [bulkGroup, setBulkGroup] = useState('');
  const [manual, setManual] = useState({ name: '', url: '', group: '' });
  const [showAdd, setShowAdd] = useState(false);

  const call = useCallback(async (body, method = 'POST') => {
    const u = authClient().currentUser;
    if (!u) return { ok: false, error: 'Signed out.' };
    const token = await u.getIdToken();
    try {
      const r = await fetch('/api/admin/iptv/channels', {
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
    if (j.ok) setState({ loading: false, channels: j.channels || [], enabled: j.enabled === true, stats: j.stats || null, shards: j.shards || null });
    else setErr(j.error || 'Load nahi hua.');
    setBusy('');
  }, [call]);

  useEffect(() => { load(); }, [load]);

  async function importNow() {
    setBusy('import'); setMsg(''); setErr('');
    const j = await call({ action: 'import', url: url.trim(), text });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Import nahi hua.'); return; }
    setState((s) => ({ ...s, channels: j.channels, stats: j.stats, enabled: true }));
    setMsg(`${j.channels.length.toLocaleString('en-PK')} channels mile${j.skipped ? `, ${j.skipped} skip` : ''} — ab "Save catalogue" dabayein.`);
    setText(''); setUrl(''); setPage(0); setSel(new Set());
  }

  async function save() {
    setBusy('save'); setMsg(''); setErr('');
    const j = await call({ action: 'save', channels: state.channels, enabled: state.enabled });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Save nahi hua.'); return; }
    setMsg(`Save — ${j.stats.live} live channels, ${j.stats.groups} groups${j.shards ? `, ${j.shards} shard docs` : ''}.`);
    setState((s) => ({ ...s, stats: j.stats }));
  }

  async function clearAll() {
    if (!confirm('Poora IPTV catalogue hata dein? /iptv/channels phir free Live TV ki list dikhayega.')) return;
    setBusy('clear'); setMsg(''); setErr('');
    const j = await call({ action: 'clear' });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Clear nahi hua.'); return; }
    setState({ loading: false, channels: [], enabled: false, stats: { total: 0, live: 0, off: 0, groups: 0 }, shards: null });
    setMsg('Catalogue khali.');
    setSel(new Set());
  }

  function addManual() {
    const name = manual.name.trim(); const link = manual.url.trim();
    if (!name || !/^https?:\/\//i.test(link)) { setErr('Naam aur http(s) link dein.'); return; }
    const id = String((state.channels.at(-1)?.id ? Number(state.channels.at(-1).id) : state.channels.length) + 1);
    setState((s) => ({ ...s, channels: [...s.channels, { id, name, url: link, group: manual.group.trim() || 'Other', logo: '', off: false, epg: '' }] }));
    setManual({ name: '', url: '', group: '' });
    setShowAdd(false);
    setMsg('Channel list mein add ho gaya — "Save catalogue" dabayein.');
  }

  const groups = useMemo(() => {
    const m = new Map();
    for (const c of state.channels) m.set(c.group || 'Other', (m.get(c.group || 'Other') || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [state.channels]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return state.channels.filter((c) => (group === 'all' || (c.group || 'Other') === group)
      && (!term || String(c.name).toLowerCase().includes(term)));
  }, [state.channels, q, group]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const allSel = rows.length > 0 && rows.every((c) => sel.has(String(c.id)));

  function toggleOne(id) {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(String(id))) next.delete(String(id)); else next.add(String(id));
      return next;
    });
  }
  function togglePage() {
    setSel((prev) => {
      const next = new Set(prev);
      if (allSel) rows.forEach((c) => next.delete(String(c.id)));
      else rows.forEach((c) => next.add(String(c.id)));
      return next;
    });
  }

  function bulkPatch(patch) {
    if (!sel.size) return;
    setState((s) => ({
      ...s,
      channels: s.channels.map((c) => (sel.has(String(c.id)) ? { ...c, ...patch } : c)),
    }));
    setMsg(`${sel.size} channels update — "Save catalogue" dabayein (ya Bulk API turant lagata hai).`);
  }

  function bulkDelete() {
    if (!sel.size || !confirm(`${sel.size} channels delete karein?`)) return;
    setState((s) => ({ ...s, channels: s.channels.filter((c) => !sel.has(String(c.id))) }));
    setMsg(`${sel.size} channels hata diye — Save dabayein.`);
    setSel(new Set());
  }

  async function bulkSave() {
    const ids = [...sel];
    if (!ids.length) return;
    setBusy('bulk'); setMsg(''); setErr('');
    const j = await call({ action: 'bulk', ids, mode: 'patch', group: bulkGroup.trim() || undefined, off: undefined });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Bulk save nahi hua.'); return; }
    setMsg(`Bulk save — ${j.changed} channels server par update.`);
    load();
  }

  const st = state.stats || { total: state.channels.length, live: state.channels.filter((c) => !c.off).length, groups: groups.length };

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold"><Tv size={16} className="text-gold" /> IPTV channel list (bulk)</h2>
          <p className="text-xs text-dim">M3U import, manual add, search, select aur bulk edit. Save par <code>/iptv/channels</code> + Xtream + Stalker sab update.</p>
        </div>
        <span className="rounded-full border border-line bg-raised px-2.5 py-1 text-[11px] font-bold text-dim">
          {st.live || 0} live · {st.groups || 0} groups{state.shards?.shardCount ? ` · ${state.shards.shardCount} shards` : ''}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="M3U link — https://.../playlist.m3u" />
        <button type="button" className="btn-ghost" onClick={importNow} disabled={!!busy || (!url.trim() && !text.trim())}>
          {busy === 'import' ? <Loader2 size={14} className="animate-spin" /> : <DownloadCloud size={14} />} Import
        </button>
      </div>
      <textarea className="input min-h-[76px] font-mono text-[11px]" value={text} onChange={(e) => setText(e.target.value)}
        placeholder={'Ya M3U paste karein:\n#EXTINF:-1 group-title="News",Geo News\nhttp://.../geo.m3u8'} />

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" onClick={() => setShowAdd((v) => !v)}><Plus size={14} /> Manual channel</button>
        <button type="button" className="btn-gold" onClick={save} disabled={!!busy || !state.channels.length}>
          {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save catalogue
        </button>
        <button type="button" className="btn-ghost" onClick={bulkSave} disabled={!!busy || !sel.size}>
          {busy === 'bulk' ? <Loader2 size={14} className="animate-spin" /> : null} Bulk save to server
        </button>
        <button type="button" className="btn-ghost" onClick={clearAll} disabled={!!busy || !state.channels.length}><Trash2 size={14} /> Clear</button>
        <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs">
          <input type="checkbox" className="h-4 w-4 accent-[#0B6B45]" checked={state.enabled} onChange={(e) => setState((s) => ({ ...s, enabled: e.target.checked }))} />
          IPTV catalogue ON
        </label>
      </div>

      {showAdd && (
        <div className="grid gap-2 rounded-xl border border-line bg-raised p-3 sm:grid-cols-3">
          <input className="input" placeholder="Channel name" value={manual.name} onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))} />
          <input className="input" placeholder="Stream link (m3u8/ts)" value={manual.url} onChange={(e) => setManual((m) => ({ ...m, url: e.target.value }))} />
          <input className="input" placeholder="Group (News, Sports…)" value={manual.group} onChange={(e) => setManual((m) => ({ ...m, group: e.target.value }))} />
          <button type="button" className="btn-gold sm:col-span-3" onClick={addManual}><Plus size={14} /> Add channel</button>
        </div>
      )}

      {msg && <p className="rounded-xl border border-gold/30 bg-gold/[0.06] px-3 py-2 text-xs font-semibold text-gold">{msg}</p>}
      {err && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{err}</p>}
      {state.loading && <p className="flex items-center gap-2 text-xs text-dim"><Loader2 size={13} className="animate-spin" /> Load ho raha hai…</p>}

      {!!state.channels.length && (
        <>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input className="input pl-8" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Channel search…" />
            </div>
            <select className="input" value={group} onChange={(e) => { setGroup(e.target.value); setPage(0); }}>
              <option value="all">All groups ({state.channels.length})</option>
              {groups.map(([g, n]) => <option key={g} value={g}>{g} ({n})</option>)}
            </select>
            <span className="self-center text-[11px] text-faint">{filtered.length} shown</span>
          </div>

          {!!sel.size && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/40 bg-gold/[0.06] p-2 text-xs">
              <b className="text-gold">{sel.size} selected</b>
              <input className="input !w-40 !py-1" value={bulkGroup} onChange={(e) => setBulkGroup(e.target.value)} placeholder="Naya group…" />
              <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => bulkPatch({ group: bulkGroup.trim() || 'Other' })}>Move group</button>
              <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => bulkPatch({ off: true })}>Turn OFF</button>
              <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => bulkPatch({ off: false })}>Turn ON</button>
              <button type="button" className="btn-ghost !px-2 !py-1 text-red-700" onClick={bulkDelete}><Trash2 size={11} /> Delete</button>
              <button type="button" className="ml-auto text-faint underline" onClick={() => setSel(new Set())}>Clear selection</button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-faint">
                <tr>
                  <th className="py-1"><button type="button" onClick={togglePage} className="text-gold" aria-label="Select page">{allSel ? <CheckSquare size={13} /> : <Square size={13} />}</button></th>
                  <th>Channel</th><th>Group</th><th>EPG id</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className={`border-t border-line/60 ${c.off ? 'opacity-50' : ''}`}>
                    <td className="py-1.5">
                      <button type="button" onClick={() => toggleOne(c.id)} className={sel.has(String(c.id)) ? 'text-gold' : 'text-faint'} aria-label="Select">
                        {sel.has(String(c.id)) ? <CheckSquare size={13} /> : <Square size={13} />}
                      </button>
                    </td>
                    <td className="max-w-[13rem]">
                      <p className="truncate text-xs font-semibold text-cream">{c.name}</p>
                      <p className="truncate font-mono text-[10px] text-faint">{String(c.url).replace(/^https?:\/\//, '').slice(0, 46)}</p>
                    </td>
                    <td className="text-xs text-dim">{c.group}</td>
                    <td className="font-mono text-[10px] text-faint">{c.epg || '—'}</td>
                    <td className="text-xs">{c.off ? <span className="text-faint">OFF</span> : <span className="text-emerald-700">live</span>}</td>
                    <td className="text-right">
                      <button type="button" className="btn-ghost !px-2 !py-1 text-[11px]"
                        onClick={() => setState((s) => ({ ...s, channels: s.channels.map((x) => (x.id === c.id ? { ...x, off: !x.off } : x)) }))}>
                        {c.off ? 'ON' : 'OFF'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-[11px] text-faint">
            <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => setPage((n) => Math.max(0, n - 1))} disabled={page === 0}>← Prev</button>
            <span>Page {page + 1} / {pages}</span>
            <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => setPage((n) => Math.min(pages - 1, n + 1))} disabled={page >= pages - 1}>Next →</button>
          </div>
        </>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-faint">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        Sirf woh channels daalein jinke rights aap ke paas hain (FTA ya authorised). Links sirf server par rehte hain — client ko kabhi nahi dikhte.
      </p>
    </section>
  );
}
