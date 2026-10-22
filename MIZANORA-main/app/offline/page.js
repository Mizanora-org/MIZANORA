export const metadata = { title: 'You are offline', robots: { index: false } };

export default function Offline() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-4xl font-bold">You are offline</h1>
      <p className="mt-3 text-dim">Please check your internet connection and try again. Your cart is saved on this phone.</p>
    </div>
  );
}
