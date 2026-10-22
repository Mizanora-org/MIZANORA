import Link from 'next/link';

export const metadata = { title: 'Page not found', robots: { index: false } };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-5xl font-bold">Page not found</h1>
      <p className="mt-3 text-dim">That page does not exist or has moved.</p>
      <Link href="/products" className="btn-gold mt-6">Shop products</Link>
    </div>
  );
}
