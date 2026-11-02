'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Users, TrendingUp, Wallet } from 'lucide-react';
import { IPTV, pkr } from '@/lib/iptv';

export default function IptvResellerCalc() {
  const [clients, setClients] = useState(40);
  const [months, setMonths] = useState(12);

  const m = useMemo(() => ({
    fee: clients * IPTV.fee.reseller,          // one-time, from the Rs 50 connection fee
    monthly: clients * IPTV.resellerMargin,     // every month, per active line
    admin: clients * IPTV.wholesale,            // what Mizanora gets each month
    gross: clients * IPTV.cap,                  // what clients pay each month
  }), [clients]);

  return (
    <div className="card border-gold/30">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-extrabold">Kamai ka hisaab</h3>
          <p className="text-xs text-dim">Slider hilayein — numbers khud badal jayenge.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Users size={14} className="text-gold" />
          <b className="text-base">{clients}</b> clients
        </div>
      </div>

      <label className="mt-4 block">
        <span className="sr-only">Clients</span>
        <input type="range" min="1" max="300" step="1" value={clients} onChange={(e) => setClients(Number(e.target.value))}
          className="w-full accent-[#0B6B45]" />
        <div className="mt-1 flex justify-between text-[10px] text-faint"><span>1</span><span>150</span><span>300</span></div>
      </label>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-raised p-3">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-faint"><Wallet size={11} /> Connection fee</p>
          <p className="mt-1 font-display text-xl font-black">{pkr(m.fee)}</p>
          <p className="text-[10px] text-faint">{clients} × Rs {IPTV.fee.reseller} (aik dafa)</p>
        </div>
        <div className="rounded-xl border border-gold/40 bg-gold/[0.06] p-3">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-faint"><TrendingUp size={11} /> Har mahine</p>
          <p className="mt-1 font-display text-xl font-black text-gold">{pkr(m.monthly)}</p>
          <p className="text-[10px] text-faint">{clients} × Rs {IPTV.resellerMargin} margin</p>
        </div>
        <div className="rounded-xl border border-line bg-raised p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Mizanora ko</p>
          <p className="mt-1 font-display text-xl font-black">{pkr(m.admin)}</p>
          <p className="text-[10px] text-faint">{clients} × Rs {IPTV.wholesale} wholesale</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-raised px-3 py-2 text-xs">
        <span className="text-dim">Clients se total wasooli: <b className="text-cream">{pkr(m.gross)}</b> / mahina</span>
        <div className="flex items-center gap-2">
          <span className="text-faint">Kitne mahine?</span>
          <select className="input w-auto py-1 text-xs" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[3, 6, 12, 24].map((x) => <option key={x} value={x}>{x} mahine</option>)}
          </select>
          <b className="text-gold">{pkr(m.monthly * months + m.fee)}</b>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/iptv/reseller" className="btn-gold">Reseller banein</Link>
        <Link href="/iptv#faq" className="btn-ghost">Rules parhein</Link>
      </div>
    </div>
  );
}
