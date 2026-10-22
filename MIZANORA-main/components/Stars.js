import { Star } from 'lucide-react';

export default function Stars({ value, size = 16 }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} className={n <= Math.round(value) ? 'text-saffron' : 'text-line'} fill="currentColor" />)}
    </span>
  );
}
