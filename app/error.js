'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

// Shown instead of a blank screen if something unexpected breaks on a page.
export default function ErrorPage({ error, reset }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="font-arabic text-3xl text-gold" lang="ar" dir="rtl">إِنَّ مَعَ الْعُسْرِ يُسْرًا</p>
      <h1 className="mt-4 text-3xl font-extrabold">Something went wrong</h1>
      <p className="mt-2 text-dim">Sorry for the trouble. Please try again. If it keeps happening, tell us on WhatsApp and we will fix it quickly.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => reset()} className="btn-gold"><RefreshCw size={18} /> Try again</button>
        <Link href="/" className="btn-ghost">Go to home</Link>
      </div>
    </div>
  );
}
