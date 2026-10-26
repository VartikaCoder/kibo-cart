/**
 * Money is integer cents everywhere inside the app (FR-010).
 * `toCents` is the only float → cents conversion; `formatMoney` is the only cents → string conversion.
 */

export type Cents = number & { readonly __brand: 'Cents' };

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function toCents(price: number): Cents {
  if (!Number.isFinite(price) || price < 0) {
    throw new RangeError(`toCents: expected a finite, non-negative price, got ${price}`);
  }
  // Math.round is load-bearing: 19.99 * 100 === 1998.9999999999998 in IEEE 754.
  return Math.round(price * 100) as Cents;
}

export function formatMoney(cents: Cents): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`formatMoney: expected integer cents, got ${cents}`);
  }
  return usd.format(cents / 100);
}
