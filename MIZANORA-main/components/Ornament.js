// A small Islamic divider: line, eight-pointed star, line.
export default function Ornament({ className = '', color = '#0B6B45' }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-px w-16 bg-gradient-to-r from-transparent" style={{ backgroundImage: `linear-gradient(to right, transparent, ${color})` }} />
      <svg width="22" height="22" viewBox="0 0 24 24"><g fill="none" stroke={color} strokeWidth="1.4"><rect x="5" y="5" width="14" height="14" /><rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)" /></g><circle cx="12" cy="12" r="1.6" fill={color} /></svg>
      <span className="h-px w-16" style={{ backgroundImage: `linear-gradient(to left, transparent, ${color})` }} />
    </div>
  );
}
