import { cartOf, line } from '@/test/fixtures/cart';
import { EMPTY_CART } from './cart';
import { lineQuantity, lineTotalCents, subtotalCents, totalQuantity } from './selectors';

// Prices chosen so float arithmetic on dollars would drift: 0.1 + 0.2, 19.99 × 3.
const cart = cartOf(line(1, 3, 1999), line(2, 1, 10), line(3, 2, 20));

describe('cart selectors (FR-009, FR-010)', () => {
  it('derives line totals, item count, and subtotal exactly in integer cents', () => {
    expect(cart.lines.map(lineTotalCents)).toEqual([5997, 10, 40]);
    expect(totalQuantity(cart)).toBe(6);
    expect(subtotalCents(cart)).toBe(6047);
  });

  it('excludes unavailable lines from count and subtotal', () => {
    expect(totalQuantity(cart, [1])).toBe(3);
    expect(subtotalCents(cart, [1, 3])).toBe(10);
  });

  it('is zero for an empty cart', () => {
    expect([totalQuantity(EMPTY_CART), subtotalCents(EMPTY_CART)]).toEqual([0, 0]);
  });

  it('reports a product’s quantity, or 0 when absent', () => {
    expect([lineQuantity(cart, 1), lineQuantity(cart, 99)]).toEqual([3, 0]);
  });
});
