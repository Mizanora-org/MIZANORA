'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import {
  Clock3, Copy, KeyRound, Loader2, LogIn, MessageCircle, RefreshCw, ShieldCheck, Tv,
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { authClient } from '@/lib/firebase-client';
import { IPTV, pkr } from '@/lib/iptv';
import { SETUP_STEPS, DEVICE_HELP } from '@/lib/iptvAccount';
import { formatDate } from '@/lib/format';
import { waLink } from '@/lib/config';

export default function IptvClaim() {
  const { user, ready } = useAuth();
  const [state, setState] = useState({ loading: true, lines: [], claim: null, error: '', email: '' });
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState('');
  const [err, setErr] = useState('');

  const token = async () => {
    const u = authClient().currentUser;
    return u ? u.getIdToken() : '';
  };

  const call = useCallback(async (body) => {
    const t = await token();
    if (!t) return { ok: false, error: 'Sign in karein.', code: 'auth' };
    try {
      const r = await fetch('/api/iptv/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(body),
      });
      return await r.json().catch(() => ({ ok: false, error: `Server ${r.status}` }));
    } catch { return { ok: false, error: 'Internet ka masla.' }; }
  }, []);

  const load = useCallback(async () => {
    if (!authClient().currentUser) { setState({ loading: false, lines: [], claim: null, error: '', email: '' }); return; }
    setState((s) => ({ ...s, loading: true }));
    const j = await call({ action: 'me' });
    if (j.ok) setState({ loading: false, lines: j.lines || [], claim: j.claim || null, error: '', email: j.email || '' });
    else setState({ loading: false, lines: [], claim: null, error: j.error || 'Load nahi hua.', email: '' });
  }, [call]);

  useEffect(() => { if (ready && user) load(); else if (ready) setState({ loading: false, lines: [], claim: null, error: '', email: '' }); }, [ready, user, load]);

  async function google() {
    setBusy('google'); setErr('');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(authClient(), provider);
    } catch (e) {
      if (e.code === 'auth/popup-blocked') { try { await signInWithRedirect(authClient(), provider); } catch (e2) { setErr('Sign in nahi hua — dobara koshish karein.'); } }
      else if (e.code !== 'auth/popup-closed-by-user') setErr('Sign in nahi hua — dobara koshish karein.');
    }
    setBusy('');
  }

  async function claim() {
    setBusy('claim'); setErr('');
    const j = await call({ action: 'claim' });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Key nahi bani.'); load(); return; }
    setState((s) => ({ ...s, lines: [j.line], claim: { ok: false, error: 'Trial le liya.' } }));
  }

  async function rotate(id) {
    setBusy('rotate'); setErr('');
    const j = await call({ action: 'rotate', id });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Password nahi badla.'); return; }
    setState((s) => ({ ...s, lines: s.lines.map((l) => (l.id === id ? { ...l, password: j.password } : l)) }));
  }

  const copy = async (text, label) => {
    try { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(''), 1500); } catch { /* blocked */ }
  };

  if (!ready) return <div className="card animate-pulse"><div className="h-6 w-40 rounded bg-raised" /><div className="mt-3 h-24 rounded bg-raised" /></div>;

  if (!user) {
    return (
      <div className="card">
        <h2 className="flex items-center gap-2 font-display text-xl font-extrabold"><KeyRound size={20} className="text-gold" /> Google se sign in — key foran</h2>
        <p className="mt-1 text-sm text-dim">
          Sign in karte hi {IPTV.trialHours} ghante ki <b>free Xtream key</b> ban jati hai — koi form, koi wait nahi.
          Username aur password turant milte hain, TiviMate / Smarters mein daal kar TV chalu.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={google} className="btn-gold" disabled={busy === 'google'}>
            {busy === 'google' ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Google se sign in
          </button>
          <Link href="/account" className="btn-ghost">Email / password</Link>
        </div>
        {err && <p className="mt-2 text-xs font-semibold text-red-600">{err}</p>}
        <p className="mt-2 text-[11px] text-faint">Sign in karne se aap ki key aap ke Mizanora account se bandh jati hai — bad mein /account/iptv par bhi milti hai.</p>
      </div>
    );
  }

  if (state.loading) {
    return <div className="card flex items-center gap-2 text-sm text-dim"><Loader2 size={16} className="animate-spin" /> Account dekh rahe hain…</div>;
  }

  const live = state.lines.find((l) => Number(l.expiresAt) > Date.now() && l.status !== 'cancelled');
  const shown = live || state.lines[0];

  return (
    <div className="space-y-3">
      {!shown && (
        <div className="card border-gold/40 bg-gold/[0.05]">
          <h2 className="flex items-center gap-2 font-display text-xl font-extrabold"><KeyRound size={20} className="text-gold" /> Aap ki free key tayyar hai</h2>
          <p className="mt-1 text-sm text-dim">
            {state.email || 'Aap ke account'} par {IPTV.trialHours} ghante ki trial key ban jayegi — 1 device, Xtream ya MAC.
          </p>
          <button type="button" className="btn-gold mt-3" onClick={claim} disabled={busy === 'claim'}>
            {busy === 'claim' ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} Free key banayein
          </button>
          {state.claim && !state.claim.ok && <p className="mt-2 text-xs text-dim">{state.claim.error}</p>}
          {err && <p className="mt-2 text-xs font-semibold text-red-600">{err}</p>}
        </div>
      )}

      {shown && (
        <div className="card">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold">{shown.trial ? 'Free trial line' : 'Aap ki IPTV line'}</h2>
              <p className="text-xs text-dim">
                {shown.maxDevices} connection · expiry {shown.expiresAt ? formatDate(shown.expiresAt) : '—'}
              </p>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${Number(shown.expiresAt) > Date.now() ? 'border-gold/30 bg-gold/10 text-gold' : 'border-red-200 bg-red-50 text-red-700'}`}>
              <Clock3 size={12} /> {Number(shown.expiresAt) > Date.now() ? `${Math.ceil((shown.expiresAt - Date.now()) / 3600e3)} ghante baqi` : 'Expired'}
            </span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Field label="Server" value={shown.server} onCopy={() => copy(shown.server, 'server')} copied={copied === 'server'} />
            <Field label="Username" value={shown.username} onCopy={() => copy(shown.username, 'user')} copied={copied === 'user'} />
            <Field label="Password" value={shown.password} onCopy={() => copy(shown.password, 'pass')} copied={copied === 'pass'} />
            <Field label="MAC (MAG box)" value={shown.mac || '—'} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => rotate(shown.id)} disabled={busy === 'rotate'}>
              {busy === 'rotate' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Naya password
            </button>
            <a className="btn-gold" href={waLink(`Meri IPTV line renew karni hai (${shown.username}). Plan: ${pkr(IPTV.cap)}/mahina.`)} target="_blank" rel="noreferrer">
              <MessageCircle size={15} /> Renew / plan
            </a>
            <Link className="btn-ghost" href="/account/iptv"><Tv size={15} /> Account page</Link>
          </div>
        </div>
      )}

      {shown && (
        <div className="card">
          <h3 className="flex items-center gap-2 font-display text-base font-bold"><ShieldCheck size={16} className="text-gold" /> Kaise chalayein</h3>
          <ol className="mt-2 space-y-1.5 text-sm text-dim">
            {SETUP_STEPS.map(([t, d], i) => (
              <li key={t} className="flex gap-2">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold/15 text-[10px] font-black text-gold">{i + 1}</span>
                <span><b className="text-cream">{t}</b> — {d}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
            {DEVICE_HELP.map(([dev, app, link]) => (
              <Link key={dev} href={link} className="rounded-xl border border-line bg-raised px-3 py-2 text-[11px] hover:border-gold">
                <b className="block text-cream">{dev}</b>
                <span className="text-faint">{app}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!shown && state.error && <p className="text-xs text-faint">{state.error}</p>}
      {shown && (
        <p className="text-[11px] text-faint">
          Trial ke baad: Rs {IPTV.fee.total} connection fee (pehla mahina included), phir Rs {IPTV.cap} mahina.
          {' '}<Link href="/iptv#plans" className="font-semibold text-gold underline underline-offset-4">Plans</Link>
        </p>
      )}
    </div>
  );
}

function Field({ label, value, onCopy, copied }) {
  return (
    <div className="rounded-xl border border-line bg-raised px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-faint">{label}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <code className="flex-1 truncate text-xs">{value || '—'}</code>
        {onCopy && (
          <button type="button" onClick={onCopy} className="text-faint hover:text-gold" aria-label={`Copy ${label}`}>
            <Copy size={12} />
          </button>
        )}
        {copied && <span className="text-[10px] font-bold text-gold">copied</span>}
      </div>
    </div>
  );
}
