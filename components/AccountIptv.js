'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import {
  Tv, Copy, RefreshCw, Smartphone, MonitorSmartphone, ShieldCheck, Clock3, AlertTriangle, CheckCircle2, MessageCircle,
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { dbClient, firebaseConfigured } from '@/lib/firebase-client';
import { IPTV, lineState, planById, pkr, renewMessage } from '@/lib/iptv';
import { waLink } from '@/lib/config';
import { formatDate } from '@/lib/format';

const TONE = {
  active: { cls: 'bg-gold/10 text-gold border-gold/30', icon: CheckCircle2 },
  expiring: { cls: 'bg-saffron/15 text-[#8a5a00] border-saffron/40', icon: Clock3 },
  expired: { cls: 'bg-red-50 text-red-700 border-red-200', icon: AlertTriangle },
  none: { cls: 'bg-raised text-dim border-line', icon: Tv },
};

export default function AccountIptv() {
  const { user, ready } = useAuth();
  const [state, setState] = useState({ loading: true, line: null, error: '' });
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    if (!user) { setState({ loading: false, line: null, error: '' }); return; }
    if (!firebaseConfigured) { setState({ loading: false, line: null, error: 'Firebase set nahi hai is build mein.' }); return; }
    setState((s) => ({ ...s, loading: true }));
    try {
      const snap = await getDocs(query(collection(dbClient(), 'iptvLines'), where('uid', '==', user.uid), limit(1)));
      const line = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
      setState({ loading: false, line, error: '' });
    } catch {
      setState({ loading: false, line: null, error: 'Line load nahi ho saki.' });
    }
  }, [user]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  const copy = async (text, label) => {
    try { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(''), 1600); } catch { /* clipboard blocked */ }
  };

  if (!ready || state.loading) {
    return <div className="card animate-pulse"><div className="h-5 w-40 rounded bg-raised" /><div className="mt-3 h-24 rounded bg-raised" /></div>;
  }

  if (!user) {
    return (
      <div className="card">
        <h2 className="font-display text-lg font-bold">Sign in karein</h2>
        <p className="mt-1 text-sm text-dim">Apni IPTV line, expiry aur device dekhne ke liye Mizanora account mein sign in karein.</p>
        <div className="mt-3 flex gap-2">
          <Link href="/account" className="btn-gold">Account kholain</Link>
          <Link href="/iptv" className="btn-ghost">Plans dekhein</Link>
        </div>
      </div>
    );
  }

  if (!state.line) {
    return (
      <div className="space-y-3">
        <div className="card">
          <h2 className="font-display text-lg font-bold">Abhi koi IPTV line nahi</h2>
          <p className="mt-1 text-sm text-dim">
            Aap ke account ({user.email || 'signed in'}) par koi line nahi mili. Trial free hai — {IPTV.trialHours} ghante, 1 device.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/iptv/trial" className="btn-gold">Free trial lein</Link>
            <Link href="/iptv#plans" className="btn-ghost">Plans dekhein</Link>
          </div>
          {state.error && <p className="mt-2 text-[11px] text-faint">{state.error}</p>}
        </div>
        <p className="text-xs text-faint">
          Line reseller banata hai. Agar aap ne payment ki hai aur line nahi dikh rahi to WhatsApp par batayein —
          {' '}<a className="font-semibold text-gold underline underline-offset-4" href={waLink('Meri IPTV line nahi dikh rahi.')} target="_blank" rel="noreferrer">support</a>.
        </p>
      </div>
    );
  }

  const line = state.line;
  const st = lineState(line.expiresAt);
  const tone = TONE[st.state] || TONE.none;
  const Icon = tone.icon;
  const plan = planById(line.plan);
  const resellerPhone = String(line.resellerPhone || '').replace(/\D/g, '');

  return (
    <div className="space-y-3">
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">{plan?.name || 'IPTV'} line</h2>
            <p className="text-xs text-dim">
              {plan?.devices || 1} connection · {line.resellerName ? `reseller: ${line.resellerName}` : 'Mizanora'}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${tone.cls}`}>
            <Icon size={13} /> {st.label}
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Info label="Username" value={line.username || '—'} onCopy={line.username ? () => copy(line.username, 'Username') : null} copied={copied === 'Username'} />
          <Info label="Password" value={line.password || '••••••••'} secret onCopy={line.password ? () => copy(line.password, 'Password') : null} copied={copied === 'Password'} />
          <Info label="Expiry" value={line.expiresAt ? formatDate(line.expiresAt) : '—'} />
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Info label="Xtream server" value={line.server || 'https://mizanora.vercel.app'} onCopy={line.server ? () => copy(line.server, 'Server') : null} copied={copied === 'Server'} />
          <Info label="MAC (Stalker)" value={line.mac || '—'} onCopy={line.mac ? () => copy(line.mac, 'MAC') : null} copied={copied === 'MAC'} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <a className="btn-gold" href={waLink(renewMessage(line))} target="_blank" rel="noreferrer">
            <RefreshCw size={15} /> Renew karein
          </a>
          {resellerPhone && (
            <a className="btn-ghost" href={`https://wa.me/92${resellerPhone.replace(/^0/, '')}`} target="_blank" rel="noreferrer">
              <MessageCircle size={15} /> Reseller se baat
            </a>
          )}
          <button type="button" className="btn-ghost" onClick={load}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      <div className="card">
        <h3 className="flex items-center gap-2 font-display text-base font-bold"><ShieldCheck size={16} className="text-gold" /> Devices</h3>
        <p className="text-xs text-dim">Aik waqt mein {line.maxDevices || plan?.devices || 1} device chal sakte hain.</p>
        <div className="mt-2 space-y-1.5">
          {[['Android TV · TiviMate', Smartphone], ['Phone · IPTV Smarters', Smartphone], ['MAG box', MonitorSmartphone]].slice(0, line.maxDevices || 1).map(([name, DIcon], i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-line bg-raised px-3 py-2 text-xs">
              <DIcon size={14} className="text-gold" />
              <span className="flex-1">{name}</span>
              <span className="text-[10px] text-faint">slot {i + 1}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-faint">
          Device badalna ho to purana device band karein — limit server par lagti hai, is liye teesra device chalne par purana khud ruk jata hai.
        </p>
      </div>

      {st.state === 'expired' || st.state === 'expiring' ? (
        <div className="card border-saffron/40 bg-saffron/[0.06]">
          <p className="flex items-start gap-2 text-sm">
            <Clock3 size={16} className="mt-0.5 shrink-0 text-saffron" />
            <span>
              Recharge har mahine {IPTV.cycle.from}–{IPTV.cycle.to} tareekh ke darmiyan: {pkr(IPTV.cap)}.
              {' '}{IPTV.suspendDay} tareekh ke baad line band ho jati hai aur TV par recharge screen chalti hai.
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-line bg-surface px-2 py-0.5">JazzCash</span>
            <span className="rounded-full border border-line bg-surface px-2 py-0.5">Easypaisa</span>
            <span className="rounded-full border border-line bg-surface px-2 py-0.5">Bank / Raast</span>
            <span className="text-faint">— number reseller panel mein set karta hai</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Info({ label, value, onCopy, copied, secret }) {
  return (
    <div className="rounded-xl border border-line bg-raised px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-faint">{label}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <code className={`flex-1 truncate text-xs ${secret ? 'tracking-widest' : ''}`}>{secret && value !== '••••••••' ? '••••••••' : value}</code>
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
