// A product/text row with an app-like feel.
//
// v60: the old Marquee ALWAYS rendered its children twice (a CSS -50% loop needs two copies), so
// every product card inside it was shipped twice — markup, images and DOM nodes. Rows of products
// are now a single swipeable copy (the default). Only the thin text ticker above the header asks
// for `loop`, where the duplicate is a few words and the movement is the point.
export default function Marquee({ children, seconds = 40, className = '', label, loop = false }) {
  if (!loop) {
    return (
      <div className={`no-sb -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 ${className}`} role="region" aria-label={label}>
        {children}
      </div>
    );
  }
  return (
    <div className={`mq ${className}`} role="region" aria-label={label}>
      <div className="mq-track animate-marquee" style={{ '--mq-dur': `${seconds}s` }}>
        <div className="flex shrink-0 items-stretch">{children}</div>
        <div className="flex shrink-0 items-stretch" aria-hidden="true" inert>{children}</div>
      </div>
    </div>
  );
}
