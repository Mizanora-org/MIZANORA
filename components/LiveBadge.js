import { badgeTone, STATE_LABEL } from '@/lib/liveBadges';

// A LITTLE ANIMATED BADGE (v33). One component for every "live" label on the shop:
//   <LiveBadge state="live" label="LIVE" />          red dot that pulses
//   <LiveBadge state="soon">SOON</LiveBadge>          amber
//   <LiveBadge state="fresh" label="NEW" />           green shiver
//   <LiveBadge state="idle" />                        grey
// The pulse, the glow and the sheen are CSS only (app/globals.css, .mz-lb*) and
// stop automatically for visitors who ask for reduced motion.
export default function LiveBadge({ state = 'live', label, size = 'md', dot = true, pulse = true, className = '', title, children }) {
  const tone = badgeTone(state);
  const text = label || children || STATE_LABEL[tone] || 'LIVE';
  return (
    <span
      className={`mz-lb is-${tone} is-${size}${pulse ? ' is-pulse' : ''}${className ? ` ${className}` : ''}`}
      title={title || String(text)}
      data-state={tone}
    >
      {dot && <i className="mz-lb-dot" aria-hidden="true" />}
      <span className="mz-lb-txt">{text}</span>
    </span>
  );
}
