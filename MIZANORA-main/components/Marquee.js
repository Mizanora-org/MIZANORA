// Seamless moving strip. Children are rendered twice; the second copy is hidden from screen readers and keyboards.
// Pauses on hover/touch-hold, and becomes a normal swipeable row for people who prefer reduced motion.
export default function Marquee({ children, seconds = 40, className = '', label }) {
  return (
    <div className={`mq ${className}`} role="region" aria-label={label}>
      <div className="mq-track animate-marquee" style={{ '--mq-dur': `${seconds}s` }}>
        <div className="flex shrink-0 items-stretch">{children}</div>
        <div className="flex shrink-0 items-stretch" aria-hidden="true" inert>{children}</div>
      </div>
    </div>
  );
}
