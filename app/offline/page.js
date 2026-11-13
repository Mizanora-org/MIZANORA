import Link from 'next/link';

export const metadata = { title: 'Connection unavailable', robots: { index: false } };

export default function Offline() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-4xl font-bold">Page abhi load nahi ho saka</h1>
      <p className="mt-3 text-dim">Internet slow ya disconnected ho sakta hai, ya website ka server filhal available nahi hai. Connection check karke dobara try karein.</p>
      <Link href="/" className="mt-6 inline-flex rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-white">Try home page</Link>
    </div>
  );
}
