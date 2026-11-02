'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Zap, Globe2, ArrowRight, Phone, Lock, Smartphone } from 'lucide-react';
import { Logo, Btn, Badge, Toast } from '@/components/ui';
import { EQ } from '@/components/charts';
import { BRAND, KPIS } from '@/lib/data';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('admin');
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('0306-2015326');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const boxes = useRef([]);

  useEffect(() => { if (step === 'otp') boxes.current[0]?.focus(); }, [step]);

  const send = () => {
    setBusy(true);
    setTimeout(() => { setBusy(false); setStep('otp'); setToast('Code sent on WhatsApp'); }, 700);
  };
  const verify = () => {
    setBusy(true);
    setTimeout(() => { router.push(mode === 'reseller' ? '/resellers' : '/dashboard'); }, 800);
  };
  const setDigit = (i, v) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...otp]; next[i] = d; setOtp(next);
    if (d && i < 3) boxes.current[i + 1]?.focus();
    if (d && i === 3 && next.every(Boolean)) setTimeout(verify, 180);
  };

  return (
    <main className="relative min-h-screen overflow-hidden noise">
      {/* aurora */}
      <div className="pointer-events-none absolute inset-0">
        <div className="aurora left-[-10%] top-[-14%] h-[46vw] w-[46vw]" style={{ background: 'radial-gradient(circle,rgba(20,184,122,.55),transparent 65%)' }} />
        <div className="aurora right-[-12%] top-[6%] h-[40vw] w-[40vw]" style={{ background: 'radial-gradient(circle,rgba(245,184,61,.35),transparent 65%)', animationDelay: '-6s' }} />
        <div className="absolute inset-0 grid-bg opacity-60" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-[1400px] items-center gap-10 px-5 py-10 lg:grid-cols-[1.15fr_.85fr] lg:px-10">
        {/* ------------------------------------------------------------- left */}
        <section className="max-w-xl">
          <div className="flex items-center gap-3">
            <Logo size={44} withText />
            <Badge tone="gold" className="ml-1">PROTOTYPE</Badge>
          </div>

          <h1 className="mt-8 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            One panel for<br />
            <span className="gradient-text">every stream</span><br />
            you sell.
          </h1>

          <p className="mt-5 max-w-md text-sm leading-relaxed text-dim sm:text-base">
            Channels, movies and series on one side — Xtream, Stalker/MAC and M3U on the other.
            Resellers, credits, EPG, ads and the 1–10 collection cycle, all in one control room.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            {['Xtream 2.9', 'Stalker / MAG', 'M3U + XMLTV', 'LL-HLS'].map((t) => (
              <span key={t} className="rounded-full border border-line bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-dim">{t}</span>
            ))}
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            {[
              [Zap, '0.9s zap', 'Playlist served from the edge, not a serverless hop.'],
              [ShieldCheck, 'Signed streams', '60s tokens, MAC binding, device limits.'],
              [Globe2, 'Four edges', 'Karachi, Lahore, Dubai, Frankfurt.'],
            ].map(([Icon, t, d], i) => (
              <div key={t} className="reveal in rounded-2xl border border-line bg-white/[0.035] p-3.5" style={{ '--d': `${120 * i}ms` }}>
                <Icon size={16} className="text-gold" />
                <b className="mt-2 block text-xs font-extrabold">{t}</b>
                <p className="mt-1 text-[11px] leading-relaxed text-faint">{d}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-4 rounded-2xl border border-line bg-white/[0.03] px-4 py-3">
            <span className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-emeraldsoft">
              <span className="h-2 w-2 rounded-full bg-emerald pulse-dot text-emerald" /> Live now
            </span>
            <span className="num text-lg font-black">{KPIS[0].value.toLocaleString('en-PK')}</span>
            <span className="text-[11px] text-faint">viewers</span>
            <EQ bars={5} color="#14b87a" />
            <span className="ml-auto hidden text-[11px] text-faint sm:block">12,864 connections · 4 nodes</span>
          </div>
        </section>

        {/* ------------------------------------------------------------ right */}
        <section className="relative mx-auto w-full max-w-[420px]">
          <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-br from-gold/15 via-transparent to-emerald/15 blur-2xl" />
          <div className="panel relative overflow-hidden p-6 sm:p-7">
            <div className="pointer-events-none absolute inset-0 shimmer opacity-[0.35]" />
            <div className="relative">
              <h2 className="text-xl font-extrabold tracking-tight">Sign in</h2>
              <p className="mt-1 text-xs text-dim">WhatsApp code — no password to leak.</p>

              <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-line bg-black/30 p-1">
                {[['admin', 'Main admin'], ['reseller', 'Reseller']].map(([id, label]) => (
                  <button key={id} onClick={() => setMode(id)}
                    className={`rounded-lg py-2 text-xs font-bold transition ${mode === id ? 'bg-white/10 text-cream shadow' : 'text-dim hover:text-cream'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {step === 'phone' ? (
                <div className="mt-5 space-y-3">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-faint">WhatsApp number</label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input pl-9" inputMode="tel" />
                  </div>
                  <Btn variant="primary" className="w-full" onClick={send} disabled={busy}>
                    {busy ? 'Sending code…' : 'Send code'} <ArrowRight size={15} />
                  </Btn>
                  <button onClick={() => router.push('/dashboard')} className="w-full text-center text-[11px] font-semibold text-faint underline-offset-4 hover:text-gold hover:underline">
                    Skip — open the demo panel
                  </button>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-faint">Code sent on WhatsApp</label>
                    <button onClick={() => setStep('phone')} className="text-[11px] font-bold text-gold">Change</button>
                  </div>
                  <div className="flex gap-2">
                    {otp.map((d, i) => (
                      <input key={i} ref={(el) => (boxes.current[i] = el)} value={d}
                        onChange={(e) => setDigit(i, e.target.value)}
                        onKeyDown={(e) => e.key === 'Backspace' && !otp[i] && boxes.current[i - 1]?.focus()}
                        className="h-14 w-full rounded-xl border border-line bg-black/30 text-center text-xl font-extrabold outline-none transition focus:border-gold/70 focus:ring-2 focus:ring-gold/15"
                        inputMode="numeric" maxLength={1} aria-label={`Digit ${i + 1}`} />
                    ))}
                  </div>
                  <Btn variant="primary" className="w-full" onClick={verify} disabled={busy || otp.some((x) => !x)}>
                    <Lock size={14} /> {busy ? 'Verifying…' : 'Verify & enter'}
                  </Btn>
                  <p className="flex items-center gap-1.5 text-[11px] text-faint">
                    <Smartphone size={12} /> Demo: type any 4 digits.
                  </p>
                </div>
              )}

              <div className="mt-6 flex items-center gap-2 border-t border-line pt-4 text-[10px] text-faint">
                <ShieldCheck size={13} className="text-emerald" />
                Prototype UI — no real admin credentials are checked.
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-[10px] text-faint">
            {BRAND.name} · {BRAND.tagline} · v0.1
          </p>
        </section>
      </div>

      <Toast msg={toast} onDone={() => setToast('')} />
    </main>
  );
}
