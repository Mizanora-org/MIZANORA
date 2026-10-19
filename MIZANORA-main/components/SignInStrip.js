'use client';
import Link from 'next/link';
import { MapPin, Package, BadgePercent } from 'lucide-react';
import { useAuth } from './AuthProvider';

// Invitation for signed-out visitors. Hidden for signed-in customers.
export default function SignInStrip() {
  const { user, ready } = useAuth();
  if (!ready || user) return null;
  return (
    <section className="mx-auto mt-4 max-w-7xl px-3 sm:px-4" aria-label="Create an account">
      <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-[#073D28] to-gold p-4 text-white sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="font-display text-lg font-extrabold sm:text-xl">Join Mizanora. It is free.</p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/90"><span className="inline-flex items-center gap-1"><MapPin size={15} /> Saved addresses</span><span className="inline-flex items-center gap-1"><Package size={15} /> Order history and bills</span><span className="inline-flex items-center gap-1"><BadgePercent size={15} /> Coupons</span></p>
        </div>
        <Link href="/account" className="btn-sun whitespace-nowrap !py-2.5">Sign in or create account</Link>
      </div>
    </section>
  );
}
