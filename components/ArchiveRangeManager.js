'use client';
import { useState } from 'react';
import { authClient } from '@/lib/firebase-client';
import { archiveDateRange, rangeSelectionKey, selectArchiveRange } from '@/lib/archiveRange';
import { makeZip } from '@/lib/zip';

const formatDay = (at) => at ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', dateStyle: 'medium' }).format(new Date(Number(at))) : 'Date missing';
async function digest(rows) {
  if (!globalThis.crypto?.subtle) throw new Error('Secure browser context required for export verification.');
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(rangeSelectionKey(rows)));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

export default function ArchiveRangeManager({ onChanged }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preview, setPreview] = useState(null);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const api = async (body) => {
    const user = authClient().currentUser;
    if (!user) throw new Error('Please sign in as admin again.');
    const r = await fetch('/api/admin/archive-range', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw new Error(data.error || `Error ${r.status}`);
    return data;
  };
  const review = async () => {
    setBusy('preview'); setMsg(''); setPreview(null); setConfirm('');
    try {
      archiveDateRange(from, to);
      setPreview(await api({ action: 'preview', from, to }));
    } catch (e) { setMsg(e.message); }
    finally { setBusy(''); }
  };
  const exportRange = async () => {
    if (!preview) return;
    setBusy('export'); setMsg('');
    try {
      const parts = [];
      for (let i = 0; i < preview.parts.length; i++) {
        setMsg(`Reading archive part ${i + 1} of ${preview.parts.length}...`);
        const n = preview.parts[i];
        const result = await api({ action: 'part', ref: preview.ref, n });
        parts.push({ n, rows: result.rows });
      }
      const result = selectArchiveRange(parts, archiveDateRange(from, to));
      if (result.matches.length !== preview.count || await digest(result.matches) !== preview.digest) throw new Error('Product files differ from the preview. No download was made. Preview again or repair the archive.');
      const byPart = new Map();
      for (const match of result.matches) {
        const { part, row: doc } = match;
        if (!byPart.has(part)) byPart.set(part, []);
        byPart.get(part).push(doc);
      }
      const files = [...byPart.entries()].map(([n, docs]) => ({ name: `products-part-${String(n).padStart(4, '0')}.json`, data: JSON.stringify(docs, null, 2) }));
      files.push({ name: 'README.txt', data: `Mizanora archived product export\nCreated date: ${from} to ${to} inclusive, Pakistan time (UTC+05:00)\nProducts: ${result.matches.length}\nSource: ${preview.ref}\nFull product fields are in the JSON files. This is a backup, not a ready-to-deploy catalogue. Firebase copies are not included.\n` });
      const blob = makeZip(files);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `mizanora-archive-${from}-to-${to}.zip`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMsg(`Exported ${result.matches.length.toLocaleString()} full archived products as a ZIP. Keep the backup safe.`);
    } catch (e) { setMsg(e.message); }
    finally { setBusy(''); }
  };
  const removeRange = async () => {
    if (!preview || confirm !== `DELETE ${preview.count}`) { setMsg(`Type DELETE ${preview?.count || ''} to confirm.`); return; }
    if (!window.confirm(`Remove ${preview.count} archived products added ${from} to ${to} from the current repository branch? Firebase copies are NOT deleted and Git history retains old versions.`)) return;
    setBusy('delete'); setMsg('');
    try {
      const r = await api({ action: 'delete', from, to, ref: preview.ref, count: preview.count, digest: preview.digest, confirm });
      setPreview(null); setConfirm('');
      setMsg(`Removed ${r.count.toLocaleString()} products from current archive files (commit ${r.commit.slice(0, 7)}). They disappear after deployment unless a Firebase copy exists. Git history retains previous versions.`);
      if (onChanged) await onChanged();
    } catch (e) { setMsg(e.message); }
    finally { setBusy(''); }
  };
  return (
    <section className="card space-y-4" aria-labelledby="archive-date-title">
      <div><h2 id="archive-date-title" className="text-lg font-extrabold">Export or delete archived products by date</h2>
        <p className="mt-1 text-xs text-dim">Both dates are included, in Pakistan time. Uses the product's original <b>created date</b>, not the last edit. This tool handles archive files only; products still in Firebase are not included or deleted.</p></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm"><span className="label">From</span><input type="date" className="input" value={from} onChange={(e) => { setFrom(e.target.value); setPreview(null); setConfirm(''); }} /></label>
        <label className="text-sm"><span className="label">To</span><input type="date" className="input" value={to} onChange={(e) => { setTo(e.target.value); setPreview(null); setConfirm(''); }} /></label>
        <button type="button" className="btn-ghost" disabled={!!busy || !from || !to} onClick={review}>{busy === 'preview' ? 'Checking...' : 'Preview range'}</button>
      </div>
      {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm">{msg}</p>}
      {preview && <div className="space-y-3 rounded-xl border border-line p-3">
        <p className="text-sm"><b>{preview.count.toLocaleString()} unique product(s)</b> match, including hidden products. {preview.undated > 0 && <span>{preview.undated.toLocaleString()} product(s) have no usable creation date and are excluded.</span>}</p>
        {preview.sample.length > 0 && <ul className="space-y-1 text-xs text-dim">{preview.sample.map((p) => <li key={p.id}>{p.name || p.id} · {formatDay(p.createdAt)}{p.hidden ? ' · hidden' : ''}</li>)}</ul>}
        <button type="button" className="btn-gold" disabled={!!busy || !preview.count} onClick={exportRange}>{busy === 'export' ? 'Preparing ZIP...' : 'Export full details as ZIP'}</button>
        {preview.canDelete ? <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-bold">Delete these {preview.count.toLocaleString()} archived products?</p>
          <p className="mt-1 text-xs">Export a backup first. Every version of each matching ID is removed from the current archive files; Git history retains old versions. Firebase copies remain visible. A deployment is required. A changed repository requires a fresh preview.</p>
          <div className="mt-2 flex flex-wrap gap-2"><input className="input !w-44 !py-1.5" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={`DELETE ${preview.count}`} aria-label={`Type DELETE ${preview.count} to confirm`} /><button type="button" className="rounded-full bg-red-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40" disabled={!!busy || !preview.count || confirm !== `DELETE ${preview.count}`} onClick={removeRange}>{busy === 'delete' ? 'Deleting...' : 'Delete from archive'}</button></div>
        </div> : <p className="text-xs text-dim">Export uses the deployed archive. Connect GitHub to delete archive files.</p>}
      </div>}
    </section>
  );
}
