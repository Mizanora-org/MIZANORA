'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, Save, ShieldCheck, Users } from 'lucide-react';
import { authClient } from '@/lib/firebase-client';

// Worker dashboard card: "Show me on the team page" (opt-in public profile).
// Everything stays private unless the worker turns this on - the API only copies name, city, a short line and a photo.
export default function WorkerPublicProfile({ worker, onSaved }) {
  const [form, setForm] = useState({ on: false, name: '', city: '', bio: '', photo: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [loaded, setLoaded] = useState(false);

  const call = useCallback(async (body) => {
    const r = await fetch('/api/worker/myprofile', {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await authClient().currentUser.getIdToken()}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || `Error ${r.status}`);
    return j;
  }, []);

  useEffect(() => {
    let live = true;
    call().then((j) => { if (live) { setForm(j.profile); setLoaded(true); } }).catch(() => setLoaded(true));
    return () => { live = false; };
  }, [call]);

  async function save(next) {
    setBusy(true); setMsg('');
    try {
      const j = await call(next ?? form);
      setForm({ on: j.on, name: j.name, city: j.city, bio: j.bio, photo: j.photo });
      setMsg(j.message);
      if (onSaved) onSaved(j);
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="card space-y-3">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold/10 text-gold"><Users size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Public profile (team page)</p>
          <p className="text-sm text-dim">Show a small profile on our public <Link href="/team" className="font-semibold text-gold underline underline-offset-4">team page</Link> - your name, city, level and a line about yourself. It is <b>optional</b> and off by default.</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${form.on ? 'bg-emerald-500/15 text-emerald-800' : 'bg-raised text-dim'}`}>{form.on ? 'Visible' : 'Hidden'}</span>
      </div>

      {!loaded ? <p className="flex items-center gap-2 text-sm text-dim"><Loader2 size={14} className="animate-spin" /> Loading your setting...</p> : (
        <>
          <div className="flex flex-wrap gap-3 text-sm">
            <button type="button" disabled={busy} onClick={() => save({ ...form, on: true })} className={`btn-gold !py-2.5 ${form.on ? 'opacity-60' : ''}`}><Eye size={16} /> Show me on the team page</button>
            <button type="button" disabled={busy} onClick={() => save({ ...form, on: false })} className={`btn-ghost !py-2.5 ${!form.on ? 'opacity-60' : ''}`}><EyeOff size={16} /> Hide me</button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="ppn">Name to show</label><input id="ppn" className="input" value={form.name} onChange={set('name')} placeholder={worker?.name || 'Your name'} maxLength={60} /></div>
            <div><label className="label" htmlFor="ppc">City</label><input id="ppc" className="input" value={form.city} onChange={set('city')} placeholder={worker?.city || 'Your city'} maxLength={40} /></div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="ppb">A line about you (optional)</label>
              <textarea id="ppb" rows={2} className="input" value={form.bio} onChange={set('bio')} maxLength={180} placeholder="e.g. Main Kasur se hoon aur 2 saal se online selling kar raha hoon." />
              <p className="mt-1 text-xs text-faint">{form.bio.length}/180</p>
            </div>
            <div className="sm:col-span-2"><label className="label" htmlFor="ppp">Photo link (optional)</label><input id="ppp" className="input" value={form.photo} onChange={set('photo')} placeholder="https://... (a clear photo of you)" /></div>
          </div>
          <button type="button" disabled={busy} onClick={() => save()} className="btn-ghost !py-2.5">{busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save my details</button>
          {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm text-cream">{msg}</p>}
          <p className="flex items-start gap-2 text-xs text-faint"><ShieldCheck size={14} className="mt-0.5 shrink-0" /> Your CNIC, phone, address, payout account and earnings are never shown anywhere public - only what you type above.</p>
        </>
      )}
    </div>
  );
}
