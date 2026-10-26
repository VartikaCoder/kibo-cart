/**
 * Human-readable age of a past moment. Pure: the caller supplies `now`, so the result is deterministic and
 * can be computed once on the server and passed to the client unchanged (no hydration mismatch).
 * Locale is fixed to match the rest of the app's formatting (research R5).
 */

const LOCALE = 'en-US';

// `numeric: 'always'` gives "1 day ago" rather than "yesterday", and never "now", which would read oddly
// after "from" ("from now" means the future).
const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'always' });

const absolute = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC', // the server's time zone isn't the reader's, so say which zone explicitly
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/** "2 hours ago", "3 days ago". Rounds down; anything under a minute (or in the future) is "1 minute ago". */
export function formatRelativeAge(then: Date, now: Date): string {
  const elapsed = Math.max(MINUTE, now.getTime() - then.getTime());
  const [unit, size] =
    elapsed < HOUR
      ? (['minute', MINUTE] as const)
      : elapsed < DAY
        ? (['hour', HOUR] as const)
        : elapsed < MONTH
          ? (['day', DAY] as const)
          : elapsed < YEAR
            ? (['month', MONTH] as const)
            : (['year', YEAR] as const);
  return relative.format(-Math.floor(elapsed / size), unit);
}

/** "Oct 26, 2026, 2:20 PM UTC". */
export function formatUtcTimestamp(date: Date): string {
  return `${absolute.format(date)} UTC`;
}
