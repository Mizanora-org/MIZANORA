'use client';
import { useState } from 'react';
import { CheckCircle2, ChevronsDown, KeyRound, Loader2, Radio, XCircle } from 'lucide-react';
import { authClient } from '@/lib/firebase-client';

// v37: connect an Xtream Codes panel (the login every IPTV provider gives you).
// Three fields - server, username, password - then Test, choose the groups you want, and Import.
// The password is sent once, never stored in state after the call, and never sent back.
//
// v38: TWO ways in, because a big panel does not fit through a browser tab:
//   "Add to the editor"  - the channels come back here so you can look before you keep them.
//                          Right for a few thousand. Nothing is saved until you press Save.
//   "Straight into the shop" - the SERVER pulls the panel, merges it with what the shop has and
//                          writes the shards itself. Use this for 10,000+ channels: only the
//                          counts travel back, so a 100,000-channel panel takes seconds, not a
//                          frozen tab. Mode: add to what is there, or replace everything.

const REMEMBER_KEY = 'mz_xtream_server'; // only the server address is remembered, never the password

export default function XtreamImport({ onChannels, onReload, max, used }) {
  const [form, setForm] = useState(() => ({
    server: typeof window !== 'undefined' ? (localStorage.getItem(REMEMBER_KEY) || '') : '',
    username: '',
    password: '',
  }));
  const [busy, setBusy] = useState('');
  const [test, setTest] = useState(null);
  const [picked, setPicked] = useState([]);
  const [what, setWhat] = useState('live');
  const [hls, setHls] = useState(true);
  const [msg, setMsg] = useState('');
  const [mode, setMode] = useState('merge');      // merge = add, replace = wipe then take the panel's
  const [done, setDone] = useState(null);         // the report from a straight-into-the-shop import

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function call(body) {
    const r = await fetch('/api/admin/tv/xtream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await authClient().currentUser.getIdToken()}` },
      body: JSON.stringify(body),
    });
    return { status: r.status, json: await r.json().catch(() => ({})) };
  }

  async function runTest(e) {
    e?.preventDefault();
    setBusy('test'); setMsg(''); setTest(null); setPicked([]);
    try {
      const { json } = await call({ action: 'test', ...form });
      if (!json.ok) { setMsg(json.error || 'Could not connect.'); return; }
      try { localStorage.setItem(REMEMBER_KEY, form.server.trim()); } catch { /* ignore */ }
      setTest(json);
      setDone(null);
      const big = json.counts && json.counts.live > 20000;
      setMsg(`Connected: ${(json.counts.live || 0).toLocaleString('en-PK')} live channels in ${json.groups.length} groups.${big ? ' That is a big panel — use "Straight into the shop" below.' : ''}${json.partial ? ' Some groups did not answer; the counts may be low.' : ''}`);
    } catch (err) { setMsg(err.message); }
    setBusy('');
  }

  async function runImport() {
    setBusy('import'); setMsg(''); setDone(null);
    try {
      const { json } = await call({ action: 'import', ...form, what, categories: picked, hls });
      if (!json.ok) {
        // 413: the panel has more than the browser should swallow. Point at the server-side way.
        if (json.tooBig) { setMsg(`${json.error}`); setMode('merge'); return; }
        setMsg(json.error || 'Import failed.');
        return;
      }
      if (!json.channels.length) { setMsg('That selection has no channels.'); return; }
      const n = onChannels(json.channels);
      setMsg(`${n.toLocaleString('en-PK')} channel${n === 1 ? '' : 's'} added to the editor from the panel${json.channels.length > n ? ` (${(json.channels.length - n).toLocaleString('en-PK')} were duplicates or over the ${Number(max).toLocaleString('en-PK')} limit)` : ''}. Press Save to publish.`);
    } catch (err) { setMsg(err.message); }
    setBusy('');
  }

  // v38: the big one. The server pulls the panel, merges, writes the shards and answers with counts.
  async function runCommit() {
    setBusy('commit'); setMsg(''); setDone(null);
    if (mode === 'replace' && !window.confirm('Replace EVERY channel in the shop with this panel\'s list? What is there now will be deleted.')) { setBusy(''); return; }
    try {
      const { json } = await call({ action: 'commit', ...form, what, categories: picked, hls, mode });
      if (!json.ok) { setMsg(json.error || 'Import failed.'); setBusy(''); return; }
      setDone(json);
      setMsg(json.message || `Done: ${json.total} channels.`);
      if (typeof onReload === 'function') onReload();
    } catch (err) { setMsg(err.message); }
    setBusy('');
  }

  const toggle = (name) => setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]));
  const busyNow = Boolean(busy);

  return (
    <div className="rounded-xl border border-line bg-raised p-3">
      <p className="flex items-center gap-2 text-sm font-extrabold"><KeyRound size={15} /> Connect an Xtream Codes panel</p>
      <p className="mt-1 text-xs text-dim">
        The same login IPTV Smarters, TiviMate and OTT Navigator use. The shop asks the panel for the channel list
        and adds it below — the password is used once, never stored, and never shown back to you.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="block text-xs">
          <span className="label">Server</span>
          <input className="input" value={form.server} onChange={(e) => set('server', e.target.value)} placeholder="http://panel.com:8080" autoComplete="off" />
        </label>
        <label className="block text-xs">
          <span className="label">Username</span>
          <input className="input" value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="username" autoComplete="off" />
        </label>
        <label className="block text-xs">
          <span className="label">Password</span>
          <input className="input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="••••••••" autoComplete="off" />
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost" disabled={busyNow || !form.server || !form.username || !form.password} onClick={runTest}>
          {busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />} Test connection
        </button>
        <span className="text-xs text-faint">{used}/{max} channels used</span>
      </div>

      {test && (
        <div className="mt-3 rounded-lg border border-line bg-surface p-3">
          <p className="flex items-center gap-2 text-xs font-bold text-emerald-400">
            <CheckCircle2 size={14} /> {test.account.username || 'Account'} · {test.account.status}
            {test.account.maxConnections ? ` · ${test.account.activeConnections}/${test.account.maxConnections} connections` : ''}
            {test.account.expired ? ' · EXPIRED' : ''}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="label mb-0">Import</span>
            {[['live', 'Live TV'], ['vod', 'Movies'], ['series', 'Series']].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setWhat(id)} className={`mz-chip${what === id ? ' is-on' : ''}`}>{label}</button>
            ))}
            <label className="ml-2 flex items-center gap-1.5">
              <input type="checkbox" className="h-3.5 w-3.5 accent-[#0B6B45]" checked={hls} onChange={(e) => setHls(e.target.checked)} />
              <span>HLS (.m3u8)</span>
            </label>
          </div>

          {test.groups.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <span className="label">Groups {picked.length ? `(${picked.length} chosen)` : '(all)'}</span>
                <div className="flex gap-2">
                  <button type="button" className="text-xs font-bold text-gold underline" onClick={() => setPicked(test.groups.map((g) => g.name))}>all</button>
                  <button type="button" className="text-xs font-bold text-dim underline" onClick={() => setPicked([])}>none</button>
                </div>
              </div>
              <div className="mt-1.5 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {test.groups.map((g) => (
                  <button key={g.name} type="button" onClick={() => toggle(g.name)} className={`mz-chip${picked.includes(g.name) ? ' is-on' : ''}`}>
                    {g.name} <i>{g.count}</i>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 rounded-lg border border-line bg-raised p-2">
            <span className="label">How to bring them in</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[['merge', 'Add to what the shop has'], ['replace', 'Replace everything']].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setMode(id)} className={`mz-chip${mode === id ? ' is-on' : ''}`}>{label}</button>
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button type="button" className="btn-ghost !py-1.5" disabled={busyNow} onClick={runImport}>
                {busy === 'import' ? <Loader2 size={14} className="animate-spin" /> : <ChevronsDown size={14} />}
                Add to the editor
              </button>
              <button type="button" className="btn-gold !py-1.5" disabled={busyNow} onClick={runCommit}>
                {busy === 'commit' ? <Loader2 size={14} className="animate-spin" /> : <ChevronsDown size={14} />}
                Straight into the shop ({what === 'live' ? 'live' : what === 'vod' ? 'movies' : 'series'}{picked.length ? `, ${picked.length} groups` : ', all'})
              </button>
            </div>
            <p className="mt-1.5 text-xs text-dim">
              <b>Add to the editor</b> brings the channels back here so you can look before you keep them — right for a few thousand, and nothing is saved until you press Save.{' '}
              <b>Straight into the shop</b> does the whole job on the server (pull, merge, write the shards) and only reports the counts. That is the one to use for 10,000+ channels or a panel that times out.
            </p>
          </div>

          {done && (
            <div className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-50 p-2 text-xs text-emerald-900">
              <p className="font-bold">Imported straight into the shop</p>
              <p className="mt-0.5">
                Pulled {Number(done.pulled || 0).toLocaleString('en-PK')} from the panel · added {Number(done.added || 0).toLocaleString('en-PK')}
                {Number(done.updated || 0) ? ` · refreshed ${Number(done.updated).toLocaleString('en-PK')}` : ''} · now {Number(done.total || 0).toLocaleString('en-PK')} channels in {done.parts} shard{done.parts === 1 ? '' : 's'}
                {done.fetched ? ` · fetched ${done.fetched === 'bulk' ? 'in one go' : 'group by group'}` : ''}
              </p>
              {done.partial ? <p className="mt-0.5 text-amber-800">Some groups did not answer, so this may be short. Try again with fewer groups ticked.</p> : null}
            </div>
          )}
        </div>
      )}

      {msg && (
        <p role="status" className={`mt-2 flex items-start gap-1.5 text-xs font-semibold ${msg.startsWith('Connected') || msg.includes('added') ? 'text-emerald-400' : 'text-amber-400'}`}>
          {msg.startsWith('Connected') || msg.includes('added') || msg.includes('Now holding') || msg.includes('now holds') || msg.includes('Replaced') ? <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> : <XCircle size={13} className="mt-0.5 shrink-0" />}
          {msg}
        </p>
      )}
    </div>
  );
}
