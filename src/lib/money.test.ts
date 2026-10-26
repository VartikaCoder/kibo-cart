import { type Cents, formatMoney, toCents } from './money';

describe('toCents', () => {
  it('rounds away float error instead of truncating (19.99 * 100 is 1998.999…)', () => {
    expect(19.99 * 100).not.toBe(1999); // the trap this function exists for
    expect(toCents(19.99)).toBe(1999);
  });

  it.each([
    [0, 0],
    [0.01, 1],
    [0.1 + 0.2, 30],
    [1.1, 110],
    [4.35, 435],
    [9.85, 985],
    [22.3, 2230],
    [109.95, 10995],
    [999.99, 99999],
    [64, 6400],
  ])('toCents(%p) === %p', (price, cents) => {
    expect(toCents(price)).toBe(cents);
  });

  it('round-trips every two-decimal price from $0.00 to $9,999.99', () => {
    const mismatches: number[] = [];
    for (let cents = 0; cents < 1_000_000; cents++) {
      if (toCents(cents / 100) !== cents) mismatches.push(cents);
    }
    expect(mismatches).toEqual([]);
  });

  it('rounds an exact half cent up', () => {
    // 0.125 and 0.375 are exactly representable, so this checks Math.round itself, not float noise.
    expect(toCents(0.125)).toBe(13);
    expect(toCents(0.375)).toBe(38);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.01, -5])('rejects %p', (price) => {
    expect(() => toCents(price)).toThrow(RangeError);
  });
});

describe('formatMoney', () => {
  it.each([
    [0, '$0.00'],
    [1, '$0.01'],
    [1999, '$19.99'],
    [10995, '$109.95'],
    [100000, '$1,000.00'],
    [123456789, '$1,234,567.89'],
  ])('formatMoney(%p) === %p', (cents, expected) => {
    expect(formatMoney(cents as Cents)).toBe(expected);
  });

  it('formats a sum of cents without float drift', () => {
    const total = (toCents(0.1) + toCents(0.2)) as Cents;
    expect(formatMoney(total)).toBe('$0.30');
  });

  it.each([19.99, Number.NaN, Number.POSITIVE_INFINITY])('rejects non-integer cents %p', (value) => {
    expect(() => formatMoney(value as Cents)).toThrow(RangeError);
  });
});
