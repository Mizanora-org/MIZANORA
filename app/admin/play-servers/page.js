'use client';
import Link from 'next/link';
import { Clapperboard, ExternalLink, Server, ShieldCheck } from 'lucide-react';
import MovieServersAdmin from '@/components/MovieServersAdmin';

// v51 — a page of its own so the play-server desk is one click from the admin menu, not buried at
// the bottom of the long Movies console. The same component is also mounted there.
export default function AdminPlayServersPage() {
  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-surface p-5">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-gold">
            <Server size={14} /> Movie player
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-cream">Play Servers</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-dim">
            Woh sources jahan se Cinema Player har movie aur series chalata hai. Ek dafa template add karein
            (jaise <code className="rounded bg-raised px-1 font-mono text-xs">https://my-cdn.com/play/{'{imdbid}'}</code>) —
            phir har title ka link khud ban jata hai.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/movies" target="_blank" className="btn-ghost inline-flex items-center gap-1.5 text-xs font-bold">
            <Clapperboard size={13} /> Open /movies <ExternalLink size={12} />
          </Link>
          <Link href="/licence" target="_blank" className="btn-ghost inline-flex items-center gap-1.5 text-xs font-bold">
            <ShieldCheck size={13} /> Licence policy
          </Link>
        </div>
      </header>

      <MovieServersAdmin />

      <p className="rounded-2xl border border-line bg-surface p-3.5 text-xs leading-relaxed text-dim">
        Yaad rakhein: sirf apne ya licensed servers add karein. Admin &gt; Movies par bhi yeh panel mojood hai
        (auto-sync console ke neeche), aur guide yahan hai:{' '}
        <Link href="/blog/movie-play-servers-admin-guide-mizanora" className="font-bold text-gold hover:underline">
          Play Servers admin guide
        </Link>.
      </p>
    </div>
  );
}
