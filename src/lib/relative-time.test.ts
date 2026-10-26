import { formatRelativeAge, formatUtcTimestamp } from './relative-time';

const captured = new Date('2026-10-26T14:20:15Z');
const after = (ms: number) => new Date(captured.getTime() + ms);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatRelativeAge', () => {
  it.each([
    ['moments later', 5_000, '1 minute ago'],
    ['in the future (clock skew)', -HOUR, '1 minute ago'],
    ['59 minutes', 59 * MIN, '59 minutes ago'],
    ['2 hours 59 minutes (rounds down)', 2 * HOUR + 59 * MIN, '2 hours ago'],
    ['1 day', DAY, '1 day ago'],
    ['3 days', 3 * DAY + 5 * HOUR, '3 days ago'],
    ['45 days', 45 * DAY, '1 month ago'],
    ['400 days', 400 * DAY, '1 year ago'],
  ])('%s → %p', (_label, elapsed, expected) => {
    expect(formatRelativeAge(captured, after(elapsed))).toBe(expected);
  });
});

describe('formatUtcTimestamp', () => {
  it('formats in UTC, whatever the server’s time zone, and says so', () => {
    expect(formatUtcTimestamp(captured)).toBe('Oct 26, 2026, 2:20 PM UTC');
  });
});
