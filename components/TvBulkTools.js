'use client';
import { useMemo, useState } from 'react';
import { Eraser, Replace, Scissors, Tags, Trash2, Wand2 } from 'lucide-react';

// v38: the small editing tools. A shop with 20,000 channels cannot be fixed one row at a time,
// so every tool here works on a SCOPE:
//   all       - every channel in the list
//   filtered  - only the ones matching the search box above
//   selected  - only the ones you ticked
// Nothing is saved until you press Save: every tool only edits the list in the browser.

const SCOPES = [['selected', 'Tick'], ['filtered', 'Search'], ['all', 'All']];

export default function TvBulkTools({ channels, filtered, selected = new Set(), setChannels, setMsg, deadCount = 0, deadIndexes = [], groups = [] }) {
  const [scope, setScope] = useState('all');
  const [field, setField] = useState('name');
  const [find, setFind] = useState('');
  const [repl, setRepl] = useState('');
  const [exact, setExact] = useState(false);
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [grpFrom, setGrpFrom] = useState('');
  const [grpTo, setGrpTo] = useState('');
  const [grpOn, setGrpOn] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);

  const indexes = useMemo(() => {
    if (scope === 'selected') return [...selected];
    if (scope === 'filtered') return (filtered || []).map((c) => c.i);
    return channels.map((_, i) => i);
  }, [scope, selected, filtered, channels]);

  const n = indexes.length;
  const apply = (fn, note) => {
    if (!n) { setMsg('Nothing is in that scope. Choose All, or search / tick some channels first.'); return; }
    const next = channels.slice();
    let touched = 0;
    for (const i of indexes) {
      const before = next[i];
      if (!before) continue;
      const after = fn(before);
      if (after && after !== before) { next[i] = after; touched += 1; }
    }
    setChannels(next);
    setMsg(`${note}: ${touched.toLocaleString('en-PK')} of ${n.toLocaleString('en-PK')} channel${n === 1 ? '' : 's'} changed. Press Save to publish.`);
  };

  // ---- find & replace -----------------------------------------------------
  const matches = useMemo(() => {
    if (!find) return 0;
    const needle = exact ? find : find.toLowerCase();
    let c = 0;
    for (const i of indexes) {
      const v = String((channels[i] || {})[field] || '');
      if ((exact ? v : v.toLowerCase()).includes(needle)) c += 1;
    }
    return c;
  }, [find, exact, field, indexes, channels]);

  const doReplace = () => {
    if (!find) { setMsg('Type what to find first.'); return; }
    const needle = exact ? find : find.toLowerCase();
    apply((c) => {
      const v = String(c[field] || '');
      if (!v || !(exact ? v : v.toLowerCase()).includes(needle)) return c;
      const out = exact ? v.split(find).join(repl) : v.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), repl);
      return { ...c, [field]: out };
    }, 'Find & replace');
  };

  // ---- delete -------------------------------------------------------------
  const del = (keep, note) => {
    const next = channels.filter((_, i) => keep(i));
    const removed = channels.length - next.length;
    setChannels(next);
    setMsg(removed ? `${removed.toLocaleString('en-PK')} channel${removed === 1 ? '' : 's'} deleted (${note}). Press Save to publish.` : 'Nothing to delete.');
  };

  const delSelected = () => { const s = new Set(selected); del((i) => !s.has(i), 'ticked'); };
  const delFiltered = () => { const s = new Set((filtered || []).map((c) => c.i)); del((i) => !s.has(i), 'search results'); };
  const delDead = () => { const s = new Set(deadIndexes); del((i) => !s.has(i), 'dead links'); };
  const delGroup = () => { const g = grpOn.trim().toLowerCase(); if (!g) { setMsg('Pick a group first.'); return; } del((i) => String(channels[i].group || '').trim().toLowerCase() !== g, `group "${grpOn}"`); };
  const delAll = () => { setChannels([]); setMsg(`All ${channels.length.toLocaleString('en-PK')} channels deleted. Press Save to publish — or press Save with the list empty to wipe the shards.`); setConfirmAll(false); };

  const Tool = ({ icon: Icon, title, children, hint }) => (
    <details className="rounded-xl border border-line bg-surface p-3">
      <summary className="cursor-pointer list-none font-bold text-cream"><Icon size={14} className="mr-1.5 inline text-gold" />{title}</summary>
      {hint && <p className="mt-1 text-xs text-dim">{hint}</p>}
      <div className="mt-2">{children}</div>
    </details>
  );

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold">Edit in bulk</h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-dim">Work on:</span>
          {SCOPES.map(([id, label]) => (
            <button key={id} type="button" className={`rounded-full border px-3 py-1 font-bold ${scope === id ? 'border-gold bg-gold/15 text-gold' : 'border-line'}`} onClick={() => setScope(id)}>
              {label}{id === 'selected' && selected.size ? ` (${selected.size})` : ''}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-dim">
        <b className="text-cream">{n.toLocaleString('en-PK')}</b> channel{n === 1 ? '' : 's'} in scope
        {scope === 'selected' && !selected.size ? ' — tick the boxes on the channels below first.' : ''}
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        <Tool icon={Replace} title="Find & replace" hint="Change a word in every name, link, logo or group at once. Handy when a panel changes its address.">
          <div className="grid gap-2 sm:grid-cols-2">
            <select className="input" value={field} onChange={(e) => setField(e.target.value)}>
              <option value="name">Channel name</option>
              <option value="url">Stream link</option>
              <option value="logo">Logo link</option>
              <option value="group">Group</option>
            </select>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-[#0B6B45]" checked={exact} onChange={(e) => setExact(e.target.checked)} /> Case sensitive</label>
            <input className="input" placeholder="Find" value={find} onChange={(e) => setFind(e.target.value)} />
            <input className="input" placeholder="Replace with" value={repl} onChange={(e) => setRepl(e.target.value)} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-ghost !py-1.5" onClick={doReplace}>Replace</button>
            {find && <span className="text-xs text-dim">{matches.toLocaleString('en-PK')} match{matches === 1 ? '' : 'es'}</span>}
            {repl === '' && find && <span className="text-xs text-dim">· empty = delete the text</span>}
          </div>
        </Tool>

        <Tool icon={Wand2} title="Add to every name" hint="Put the same word in front of, or behind, every channel name in scope.">
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="input" placeholder="Prefix (e.g. PK )" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            <input className="input" placeholder="Suffix (e.g.  HD)" value={suffix} onChange={(e) => setSuffix(e.target.value)} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-ghost !py-1.5" disabled={!prefix} onClick={() => apply((c) => (c.name.startsWith(prefix) ? c : { ...c, name: `${prefix}${c.name}`.slice(0, 70) }), 'Prefix')}>Add prefix</button>
            <button type="button" className="btn-ghost !py-1.5" disabled={!suffix} onClick={() => apply((c) => (c.name.endsWith(suffix) ? c : { ...c, name: `${c.name}${suffix}`.slice(0, 70) }), 'Suffix')}>Add suffix</button>
            <button type="button" className="btn-ghost !py-1.5" onClick={() => apply((c) => ({ ...c, name: c.name.replace(/(?:^|\s)\S/g, (m) => m.toUpperCase()).slice(0, 70) }), 'Capitalised')}>Capitalise Each Word</button>
            <button type="button" className="btn-ghost !py-1.5" onClick={() => apply((c) => ({ ...c, name: c.name.replace(/\s+/g, ' ').trim().slice(0, 70) }), 'Tidied')}>Tidy spaces</button>
          </div>
        </Tool>

        <Tool icon={Tags} title="Groups" hint="Rename a group, move channels between groups, or switch a whole group off at once.">
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="input" list="mz-tv-groups" placeholder="From group" value={grpFrom} onChange={(e) => setGrpFrom(e.target.value)} />
            <input className="input" placeholder="To group" value={grpTo} onChange={(e) => setGrpTo(e.target.value)} />
          </div>
          <datalist id="mz-tv-groups">{groups.map((g) => <option key={g.name} value={g.name} />)}</datalist>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-ghost !py-1.5" disabled={!grpFrom} onClick={() => apply((c) => (String(c.group || '') === grpFrom ? { ...c, group: grpTo.slice(0, 40) } : c), 'Group renamed')}>Rename group</button>
            <button type="button" className="btn-ghost !py-1.5" disabled={!grpFrom} onClick={() => del((i) => String(channels[i].group || '') !== grpFrom, `group "${grpFrom}"`)}>Delete this group</button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input className="input" list="mz-tv-groups" placeholder="Group to switch on / off" value={grpOn} onChange={(e) => setGrpOn(e.target.value)} />
            <button type="button" className="btn-ghost !py-1.5" disabled={!grpOn} onClick={() => apply((c) => (String(c.group || '').toLowerCase() === grpOn.trim().toLowerCase() ? { ...c, off: false } : c), 'Switched on')}>Switch on</button>
            <button type="button" className="btn-ghost !py-1.5" disabled={!grpOn} onClick={() => apply((c) => (String(c.group || '').toLowerCase() === grpOn.trim().toLowerCase() ? { ...c, off: true } : c), 'Switched off')}>Switch off</button>
          </div>
        </Tool>

        <Tool icon={Scissors} title="Clean up" hint="Duplicates, dead weight and ordering. Dedupe by link keeps the FIRST copy; by name keeps the first spelling.">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost !py-1.5" onClick={() => {
              const seen = new Set();
              const kill = new Set();
              channels.forEach((c, i) => { if (seen.has(c.url)) kill.add(i); else seen.add(c.url); });
              del((i) => !kill.has(i), 'duplicate links');
            }}>Remove duplicate links</button>
            <button type="button" className="btn-ghost !py-1.5" onClick={() => {
              const seen = new Set();
              const kill = new Set();
              channels.forEach((c, i) => { const k = c.name.toLowerCase().trim(); if (seen.has(k)) kill.add(i); else seen.add(k); });
              del((i) => !kill.has(i), 'duplicate names');
            }}>Remove duplicate names</button>
            <button type="button" className="btn-ghost !py-1.5" onClick={() => apply((c) => (c.logo ? { ...c, logo: '' } : c), 'Logos cleared')}>Remove all logos</button>
            <button type="button" className="btn-ghost !py-1.5" onClick={() => setChannels([...channels].sort((a, b) => String(a.name).localeCompare(String(b.name), 'en', { numeric: true })))}>Sort A → Z</button>
            <button type="button" className="btn-ghost !py-1.5" onClick={() => setChannels([...channels].sort((a, b) => String(a.group || '').localeCompare(String(b.group || ''), 'en') || String(a.name).localeCompare(String(b.name), 'en', { numeric: true })))}>Sort by group</button>
            <button type="button" className="btn-ghost !py-1.5" onClick={() => setChannels([...channels].reverse())}>Reverse order</button>
          </div>
        </Tool>
      </div>

      <div className="rounded-xl border-2 border-red-500/40 bg-red-50 p-3">
        <h3 className="flex items-center gap-1.5 font-bold text-red-800"><Trash2 size={15} /> Delete in bulk</h3>
        <p className="mt-1 text-xs text-red-900/80">Deleting only changes the list here. Nothing leaves the database until you press Save.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="btn-ghost !py-1.5" disabled={!selected.size} onClick={delSelected}>Delete ticked ({selected.size})</button>
          <button type="button" className="btn-ghost !py-1.5" disabled={!(filtered || []).length} onClick={delFiltered}>Delete search results ({(filtered || []).length})</button>
          <button type="button" className="btn-ghost !py-1.5" disabled={!grpOn} onClick={delGroup}>Delete a group</button>
          <button type="button" className="btn-ghost !py-1.5" disabled={!deadCount} onClick={delDead}>Delete dead ({deadCount})</button>
          {confirmAll ? (
            <span className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-2 py-1">
              <b className="text-sm text-red-700">Delete all {channels.length.toLocaleString('en-PK')}?</b>
              <button type="button" className="btn-gold !py-1 !text-xs" onClick={delAll}>Yes, delete all</button>
              <button type="button" className="btn-ghost !py-1 !text-xs" onClick={() => setConfirmAll(false)}>Cancel</button>
            </span>
          ) : (
            <button type="button" className="btn-ghost !py-1.5 !border-red-400 !text-red-700" disabled={!channels.length} onClick={() => setConfirmAll(true)}><Eraser size={14} className="mr-1 inline" />Delete all channels</button>
          )}
        </div>
      </div>
    </section>
  );
}
