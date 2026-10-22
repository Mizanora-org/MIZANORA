import Link from 'next/link';

export function PageHead({ title, intro, crumbs = [] }) {
  return (
    <div className="border-b border-line">
      <div className="mx-auto max-w-6xl px-4 pb-6 pt-10">
        {crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-3 text-xs text-faint">
            {crumbs.map(([href, label], i) => (
              <span key={label}>{i > 0 && ' / '}{href ? <Link href={href} className="hover:text-gold">{label}</Link> : label}</span>
            ))}
          </nav>
        )}
        <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight sm:text-5xl">{title}</h1>
        {intro && <p className="mt-3 max-w-2xl text-lg text-dim">{intro}</p>}
      </div>
    </div>
  );
}

export function Prose({ children }) {
  return <div className="prose-mz mx-auto max-w-3xl px-4 py-8">{children}</div>;
}
