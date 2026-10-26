import { VisuallyHidden } from './visually-hidden';

interface RatingProps {
  rate: number;
  count: number;
  max?: number;
}

const STAR_PATH =
  'M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z';

function Stars({ count, className }: { count: number; className: string }) {
  return (
    <span className={`flex ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="size-4 shrink-0" fill="currentColor">
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}

/** Stars are decorative; the accessible text carries the meaning (not colour or shape alone). */
export function Rating({ rate, count, max = 5 }: RatingProps) {
  const fill = `${Math.min(100, Math.max(0, (rate / max) * 100))}%`;
  const reviews = count === 1 ? '1 review' : `${count} reviews`;

  return (
    <p className="flex items-center gap-1.5 text-sm text-ink-muted">
      <span aria-hidden="true" className="relative inline-flex">
        <Stars count={max} className="text-border" />
        <span className="absolute inset-0 overflow-hidden" style={{ width: fill }}>
          <Stars count={max} className="text-star" />
        </span>
      </span>
      <span aria-hidden="true">
        {rate.toFixed(1)} ({count})
      </span>
      <VisuallyHidden>
        Rated {rate} out of {max} ({reviews})
      </VisuallyHidden>
    </p>
  );
}
