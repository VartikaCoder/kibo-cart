import type { Cents } from '@/lib/money';
import { cartOf, frozen, line } from '@/test/fixtures/cart';
import { reconcileWithCatalogue } from './reconcile';

const prices = (entries: [number, number][]) => new Map(entries as [number, Cents][]);

describe('reconcileWithCatalogue (FR-018)', () => {
  it('updates changed prices, reports them, and reports products missing from the catalogue', () => {
    const start = frozen(cartOf(line(1, 2, 1000), line(2, 1, 500), line(3, 4, 250)));

    const result = reconcileWithCatalogue(start, prices([[1, 1200], [3, 250]]));

    expect(result.cart.lines.map((l) => [l.productId, l.unitPriceCents, l.quantity])).toEqual([
      [1, 1200, 2],
      [2, 500, 1], // missing: kept as-is for the shopper to remove
      [3, 250, 4],
    ]);
    expect(result.priceChanges).toEqual([{ productId: 1, fromCents: 1000, toCents: 1200 }]);
    expect(result.missingIds).toEqual([2]);
  });

  it('returns the same cart when no price changed', () => {
    const start = frozen(cartOf(line(1, 2, 1000)));
    const result = reconcileWithCatalogue(start, prices([[1, 1000]]));
    expect(result).toEqual({ cart: start, priceChanges: [], missingIds: [] });
    expect(result.cart).toBe(start);
  });
});
