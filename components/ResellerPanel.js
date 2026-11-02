'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users, Wallet, TrendingUp, AlertTriangle, Loader2, Copy, MessageCircle, Plus, RefreshCw,
  Ban, PlayCircle, CheckCircle2, Settings2, ShieldCheck, CreditCard, Clock3,
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { authClient } from '@/lib/firebase-client';
import { IPTV, pkr } from '@/lib/iptv';
import { marginOf, MAX_CLIENT_PRICE, MIN_CLIENT_PRICE, clientTotal, clientMessage } from '@/lib/iptvReseller';
import { formatDate } from '@/lib/format';

const PLANS = [
  ['starter', 'Starter · 1 device'],
  ['family', 'Family · 2 devices'],
  ['premium', 'Premium · 3 devices'],
];

export default function ResellerPanel() {
  const { user, ready } = useAuth();
  const [state, setState] = useState({ loading: true, data: null, error: '', code: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState('');

  const call = useCallback(async (body) => {
    try {
      const u = authClient().currentUser;
      if (!u) return { ok: false, error: 'Sign in karein.', code: 'auth' };
      const token = await u.getIdToken();
      const r = await fetch('/api/reseller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({ ok: false, error: 'Server ne jawab nahi diya.' }));
      return { ...j, status: r.status };
    } catch {
      return { ok: false, error: 'Internet ka masla — dobara koshish karein.' };
    }
  }, []);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const j = await call({ action: 'me' });
    if (j.ok) setState({ loading: false, data: j, error: '', code: '' });
    else setState({ loading: false, data: null, error: j.error || 'Load nahi hua.', code: j.code || '' });
  }, [call]);

  useEffect(() => { if (ready && user) load(); else if (ready) setState({ loading: false, data: null, error: '', code: 'auth' }); }, [ready, user, load]);

  const act = async (action, payload, label) => {
    setBusy(action + (payload?.id || ''));
    setMsg('');
    const j = await call({ action, ...payload });
    setBusy('');
    if (j.ok) { setMsg(label); load(); } else setMsg(j.error || 'Nahi hua.');
    return j;
  };

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); setCopied('1'); setTimeout(() => setCopied(''), 1500); } catch { /* blocked */ }
  };

  if (!ready || state.loading) {
    return <div className="card animate-pulse"><div className="h-5 w-40 rounded bg-raised" /><div className="mt-3 h-32 rounded bg-raised" /></div>;
  }

  if (state.code === 'auth') {
    return (
      <div className="card">
        <h2 className="font-display text-lg font-bold">Reseller panel ke liye sign in</h2>
        <p className="mt-1 text-sm text-dim">Yahan aap apne clients, lines aur kamai dekh sakte hain. Mizanora account se sign in karein.</p>
        <div className="mt-3 flex gap-2">
          <Link href="/account" className="btn-gold">Sign in</Link>
          <Link href="/iptv/reseller" className="btn-ghost">Reseller banein</Link>
        </div>
      </div>
    );
  }

  if (!state.data) {
    const pending = state.code === 'pending';
    return (
      <div className="space-y-3">
        <div className="card border-saffron/40 bg-saffron/[0.06]">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-saffron" />
            <div>
              <h2 className="font-display text-lg font-bold">{pending ? 'Application review mein hai' : 'Reseller account nahi mila'}</h2>
              <p className="mt-1 text-sm text-dim">{state.error}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/iptv/reseller" className="btn-gold">Reseller page</Link>
                <a href={`https://wa.me/${IPTV.support}?text=${encodeURIComponent('Mujhe Mizanora IPTV reseller banna hai.')}`} target="_blank" rel="noreferrer" className="btn-ghost">
                  <MessageCircle size={15} /> WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-faint">Approval ke baad yahi page aap ka panel ban jayega — clients, lines, kamai, sab.</p>
      </div>
    );
  }

  const { reseller, lines, stats, cycle } = state.data;
  const credit = Number(reseller.credit) || 0;
  const used = lines.filter((l) => l.status !== 'cancelled').length;
  const remaining = Math.max(0, credit - used);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-extrabold">{reseller.name || 'Reseller'} panel</h2>
          <p className="text-xs text-dim">{reseller.phone || '—'} · credit {used}/{credit} · price {pkr(reseller.price)}/mahina</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-1 text-[11px] font-bold text-dim">
          <Clock3 size={12} className="text-gold" /> {cycle.label}
        </span>
      </div>

      {msg && <p className="rounded-xl border border-gold/30 bg-gold/[0.06] px-3 py-2 text-xs font-semibold text-gold">{msg}</p>}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [Users, stats.clients, 'Clients', 'text-cream'],
          [PlayCircle, stats.active, 'Active lines', 'text-gold'],
          [Wallet, pkr(stats.mrr), 'Client se / mahina', 'text-cream'],
          [TrendingUp, pkr(stats.margin), 'Aap ka munafa', 'text-gold'],
        ].map(([Icon, v, l, c]) => (
          <div key={l} className="card">
            <Icon size={16} className="text-gold" />
            <p className={`mt-2 font-display text-xl font-black ${c}`}>{v}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-faint">{l}</p>
          </div>
        ))}
      </div>

      <div className="card border-line">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5"><CreditCard size={13} className="text-gold" /> Mizanora ko dena: <b>{pkr(stats.due)}</b></span>
          <span className="text-faint">{IPTV.cycle.from}–{IPTV.cycle.to} tak · JazzCash {IPTV.support.replace(/^92/, '0')}</span>
          <span className="rounded-full border border-line bg-raised px-2 py-0.5 text-[10px] font-bold">{stats.expiring} expiring · {stats.expired} expired</span>
        </div>
      </div>

      {created && <NewLineCard line={created} onClose={() => setCreated(null)} copy={copy} copied={copied} />}

      <NewClient
        price={reseller.price}
        remaining={remaining}
        busy={busy}
        onCreate={async (form) => {
          const j = await act('createClient', form, 'Line ban gayi — credentials neeche hain.');
          if (j.ok) { setCreated(j.line); load(); }
          return j;
        }}
      />

      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-base font-bold">Clients</h2>
          <span className="text-[11px] text-faint">{lines.length} total</span>
        </div>
        {lines.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wider text-faint">
                  <th className="py-2">Client</th><th>Plan</th><th>Price</th><th>Expiry</th><th>State</th><th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const exp = Number(l.expiresAt) || 0;
                  const days = Math.ceil((exp - Date.now()) / 86400e3);
                  const suspended = l.status === 'suspended' || l.status === 'cancelled';
                  const tone = suspended ? 'border-line bg-raised text-dim'
                    : days <= 0 ? 'border-red-200 bg-red-50 text-red-700'
                      : days <= 3 ? 'border-saffron/40 bg-saffron/10 text-[#8a5a00]'
                        : 'border-gold/30 bg-gold/10 text-gold';
                  const label = l.status === 'cancelled' ? 'Cancelled' : suspended ? 'Suspended' : days <= 0 ? 'Expired' : `${days} din`;
                  return (
                    <tr key={l.id} className="border-b border-line/60">
                      <td className="py-2">
                        <b className="block">{l.clientName || l.name || '—'}</b>
                        <span className="text-[11px] text-faint">{l.phone || ''} {l.username ? `· ${l.username}` : ''}</span>
                      </td>
                      <td className="text-dim">{l.plan}</td>
                      <td className="tabular-nums text-dim">{pkr(l.price)}</td>
                      <td className="text-[11px] text-dim">{exp ? formatDate(exp) : '—'}</td>
                      <td><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone}`}>{label}</span></td>
                      <td className="text-right">
                        <div className="inline-flex gap-1">
                          <button type="button" className="btn-ghost btn-sm" disabled={!!busy} onClick={() => act('renew', { id: l.id, months: 1 }, `${l.clientName || 'Client'} 1 mahina renew`)}>
                            {busy === `renew${l.id}` ? <Loader2 size={12} className="animate-spin" /> : '+1m'}
                          </button>
                          {suspended ? (
                            <button type="button" className="btn-ghost btn-sm" disabled={!!busy} onClick={() => act('resume', { id: l.id }, 'Line chalu')} title="Resume">
                              <PlayCircle size={12} />
                            </button>
                          ) : (
                            <button type="button" className="btn-ghost btn-sm" disabled={!!busy} onClick={() => act('suspend', { id: l.id }, 'Line suspend')} title="Suspend">
                              <Ban size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-dim">Abhi koi client nahi — upar se pehla client banayein. Credit: {remaining} lines baqi.</p>
        )}
      </section>

      <SettingsSection reseller={reseller} busy={busy} onSave={act} />
    </div>
  );
}

function NewClient({ price, remaining, busy, onCreate }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', plan: 'starter', months: 1, price: price || MAX_CLIENT_PRICE, device: 'xtream' });
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => { setForm((f) => ({ ...f, price: price || MAX_CLIENT_PRICE })); }, [price]);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErr(''); };
  const p = Math.min(MAX_CLIENT_PRICE, Math.max(MIN_CLIENT_PRICE, Number(form.price) || MAX_CLIENT_PRICE));

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!remaining) { setErr('Credit khatam — admin se barhwayein.'); return; }
    const j = await onCreate({ ...form, months: Number(form.months), price: p });
    if (!j.ok) setErr(j.error || 'Line nahi bani.');
  }

  return (
    <section className="card">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <span className="flex items-center gap-2 font-display text-base font-bold"><Plus size={16} className="text-gold" /> Naya client</span>
        <span className="text-[11px] text-faint">{remaining} lines baqi · {open ? 'band karein' : 'kholein'}</span>
      </button>

      {open && (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="label">Client ka naam</span>
              <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ali Raza" required />
            </label>
            <label className="block"><span className="label">WhatsApp number</span>
              <input className="input" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="03XX-XXXXXXX" required />
            </label>
            <label className="block"><span className="label">Email (optional — account se jorne ke liye)</span>
              <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="client@example.com" />
            </label>
            <label className="block"><span className="label">Plan</span>
              <select className="input" value={form.plan} onChange={(e) => set('plan', e.target.value)}>
                {PLANS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="block"><span className="label">Mahine</span>
              <select className="input" value={form.months} onChange={(e) => set('months', e.target.value)}>
                <option value={1}>1 mahina</option>
                <option value={3}>3 mahine</option>
                <option value={12}>12 mahine</option>
              </select>
            </label>
            <label className="block"><span className="label">Price per month ({pkr(MIN_CLIENT_PRICE)}–{pkr(MAX_CLIENT_PRICE)})</span>
              <input className="input" type="number" min={MIN_CLIENT_PRICE} max={MAX_CLIENT_PRICE} value={form.price} onChange={(e) => set('price', e.target.value)} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-raised px-3 py-2 text-xs">
            <span>Client se: <b>{pkr(clientTotal(p, form.months))}</b></span>
            <span className="text-faint">·</span>
            <span>Mizanora ko: <b>{pkr(IPTV.wholesale * Number(form.months))}</b></span>
            <span className="text-faint">·</span>
            <span className="text-gold">Aap ka: <b>{pkr(marginOf(p) * Number(form.months))}</b></span>
          </div>
          {err && <p className="text-xs font-semibold text-red-600">{err}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn-gold" disabled={!!busy}>
              {busy === 'createClient' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Line banayein
            </button>
            <span className="text-[11px] text-faint">Credentials foran ban jate hain — client ko WhatsApp par bhej dein.</span>
          </div>
        </form>
      )}
    </section>
  );
}

function NewLineCard({ line, onClose, copy, copied }) {
  const [server] = useState(line.server || 'http://dns.mizanora.tv:8080');
  const text = clientMessage({ ...line, name: line.clientName, server });
  const wa = `https://wa.me/92${String(line.phone || '').replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
  return (
    <section className="card border-gold/40 bg-gold/[0.04]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-extrabold"><CheckCircle2 size={18} className="text-gold" /> {line.clientName} ki line ready</h3>
          <p className="text-xs text-dim">{line.plan} · {line.months} mahina · {pkr(line.price)}/mahina</p>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-faint hover:text-gold">band</button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Row label="Server" value={server} />
        <Row label="Username" value={line.username} />
        <Row label="Password" value={line.password} />
        <Row label="MAC" value={line.mac || '—'} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" onClick={() => copy(text)}><Copy size={14} /> {copied ? 'Copied' : 'Poora message copy'}</button>
        <a className="btn-gold" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp par bhejein</a>
      </div>
      <p className="mt-2 text-[11px] text-faint">Ye credentials sirf client ko dein. Password badalna ho to line suspend kar ke nayi banayein.</p>
    </section>
  );
}

function Row({ label, value }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-faint">{label}</p>
      <code className="mt-0.5 block truncate text-xs">{value || '—'}</code>
    </div>
  );
}

function SettingsSection({ reseller, busy, onSave }) {
  const [price, setPrice] = useState(reseller.price || MAX_CLIENT_PRICE);
  const [pay, setPay] = useState({ jazzcash: '', easypaisa: '', bank: '', accountName: '', ...(reseller.payment || {}) });

  return (
    <section className="card">
      <h2 className="flex items-center gap-2 font-display text-base font-bold"><Settings2 size={16} className="text-gold" /> Settings</h2>
      <p className="text-xs text-dim">Apni price (cap {pkr(MAX_CLIENT_PRICE)}) aur payment number — client ko recharge screen par yahi dikhta hai.</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Naye client ka price / mahina</span>
          <input className="input" type="number" min={MIN_CLIENT_PRICE} max={MAX_CLIENT_PRICE} value={price} onChange={(e) => setPrice(e.target.value)} />
          <span className="mt-1 block text-[11px] text-faint">Aap ka munafa: {pkr(marginOf(price))} per line. Purane clients ka rate nahi badalta.</span>
        </label>
        <div className="rounded-xl border border-line bg-raised px-3 py-2 text-[11px] text-dim">
          <p className="flex items-center gap-1.5 font-bold text-cream"><ShieldCheck size={13} className="text-gold" /> Cap ka usool</p>
          <p className="mt-1">Rs {MAX_CLIENT_PRICE} se zyada charge karna system mana karta hai. Rs {MIN_CLIENT_PRICE} se kam bechna aap ka nuqsan hai.</p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">JazzCash</span>
          <input className="input" inputMode="tel" value={pay.jazzcash} onChange={(e) => setPay({ ...pay, jazzcash: e.target.value })} placeholder="03XX-XXXXXXX" />
        </label>
        <label className="block"><span className="label">Easypaisa</span>
          <input className="input" inputMode="tel" value={pay.easypaisa} onChange={(e) => setPay({ ...pay, easypaisa: e.target.value })} placeholder="03XX-XXXXXXX" />
        </label>
        <label className="block"><span className="label">Bank / Raast</span>
          <input className="input" value={pay.bank} onChange={(e) => setPay({ ...pay, bank: e.target.value })} placeholder="Meezan 0123-xxxxxxx" />
        </label>
        <label className="block"><span className="label">Account ka naam</span>
          <input className="input" value={pay.accountName} onChange={(e) => setPay({ ...pay, accountName: e.target.value })} placeholder="Ali Traders" />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-gold" disabled={!!busy} onClick={() => onSave('setPrice', { price: Number(price) }, 'Price update ho gaya')}>
          {busy === 'setPrice' ? <Loader2 size={14} className="animate-spin" /> : null} Price save
        </button>
        <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => onSave('setPayment', pay, 'Payment detail save')}>
          {busy === 'setPayment' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Payment save
        </button>
      </div>
    </section>
  );
}
