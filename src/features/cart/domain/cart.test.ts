import { cartOf, frozen, line, snapshot } from '@/test/fixtures/cart';
import { addItem, clampToLimits, decrement, EMPTY_CART, increment, removeLine, setQuantity } from './cart';
import type { Cart } from './types';

const MAX = 5;
const quantities = (cart: Cart) => cart.lines.map((l) => [l.productId, l.quantity]);

describe('addItem (FR-006, FR-007)', () => {
  it('appends a new line with quantity 1, keeping insertion order', () => {
    const { cart, outcome } = addItem(frozen(cartOf(line(1, 2))), snapshot(2, 2230), MAX);

    expect(outcome).toEqual({ type: 'added', productId: 2, quantity: 1 });
    expect(cart.lines).toEqual([line(1, 2), line(2, 1, 2230)]);
  });

  it('increments an existing line instead of adding a duplicate', () => {
    const { cart, outcome } = addItem(frozen(cartOf(line(1, 2))), snapshot(1), MAX);

    expect(outcome).toEqual({ type: 'incremented', productId: 1, quantity: 3 });
    expect(quantities(cart)).toEqual([[1, 3]]);
  });

  it('stores only cart fields, even if the caller passes a richer object', () => {
    const product = { ...snapshot(1), description: 'x', rating: { rate: 4, count: 1 } };
    const { cart } = addItem(EMPTY_CART, product, MAX);
    expect(Object.keys(cart.lines[0]).sort()).toEqual(['imageUrl', 'productId', 'quantity', 'title', 'unitPriceCents']);
  });

  it.each([
    ['an existing line at the max', cartOf(line(1, MAX)), MAX, MAX],
    ['a new product with no availability', EMPTY_CART, 0, 0],
  ])('reports limit-reached and changes nothing for %s', (_label, start, max, quantity) => {
    const result = addItem(frozen(start), snapshot(1), max);

    expect(result.outcome).toEqual({ type: 'limit-reached', productId: 1, quantity, maxQuantity: max });
    expect(result.cart).toBe(start);
  });

  it('counts every one of N rapid adds exactly once, then stops at the max', () => {
    let cart = EMPTY_CART;
    const outcomes = Array.from({ length: 8 }, () => {
      const result = addItem(cart, snapshot(1), MAX);
      cart = result.cart;
      return result.outcome.type;
    });

    expect(quantities(cart)).toEqual([[1, MAX]]);
    expect(outcomes).toEqual(['added', 'incremented', 'incremented', 'incremented', 'incremented', 'limit-reached', 'limit-reached', 'limit-reached']);
  });
});

describe('increment / decrement / removeLine', () => {
  const start = frozen(cartOf(line(1, 2), line(2, MAX), line(3, 1)));

  it.each([
    ['increment below max', () => increment(start, 1, MAX), { type: 'incremented', productId: 1, quantity: 3 }, [[1, 3], [2, MAX], [3, 1]]],
    ['decrement above 1', () => decrement(start, 1), { type: 'decremented', productId: 1, quantity: 1 }, [[1, 1], [2, MAX], [3, 1]]],
    ['decrement at 1 removes the line', () => decrement(start, 3), { type: 'removed', productId: 3 }, [[1, 2], [2, MAX]]],
    ['removeLine', () => removeLine(start, 2), { type: 'removed', productId: 2 }, [[1, 2], [3, 1]]],
  ])('%s', (_label, run, outcome, expected) => {
    const result = run();
    expect(result.outcome).toEqual(outcome);
    expect(quantities(result.cart)).toEqual(expected);
  });

  it('increment at the max reports limit-reached and changes nothing', () => {
    const result = increment(start, 2, MAX);
    expect(result.outcome).toEqual({ type: 'limit-reached', productId: 2, quantity: MAX, maxQuantity: MAX });
    expect(result.cart).toBe(start);
  });

  it.each([
    ['increment', () => increment(start, 99, MAX)],
    ['decrement', () => decrement(start, 99)],
    ['removeLine', () => removeLine(start, 99)],
    ['setQuantity', () => setQuantity(start, 99, 2, MAX)],
  ])('%s on a product not in the cart reports not-found and changes nothing', (_label, run) => {
    const result = run();
    expect(result.outcome).toEqual({ type: 'not-found', productId: 99 });
    expect(result.cart).toBe(start);
  });
});

describe('setQuantity (FR-008)', () => {
  const start = frozen(cartOf(line(1, 3)));

  it.each<[string | number, object, number]>([
    [4, { type: 'updated', quantity: 4 }, 4],
    [' 2 ', { type: 'updated', quantity: 2 }, 2],
    [3, { type: 'unchanged', quantity: 3 }, 3],
    [9, { type: 'clamped', quantity: MAX, requested: 9, maxQuantity: MAX }, MAX],
    [0, { type: 'clamped', quantity: 1, requested: 0, maxQuantity: MAX }, 1],
    ['-2', { type: 'clamped', quantity: 1, requested: -2, maxQuantity: MAX }, 1],
  ])('setQuantity(%p) → %p', (raw, outcome, quantity) => {
    const result = setQuantity(start, 1, raw, MAX);
    expect(result.outcome).toEqual({ productId: 1, ...outcome });
    expect(quantities(result.cart)).toEqual([[1, quantity]]);
  });

  it.each(['', '  ', 'abc', '2.5', '1e2', '0x5', 2.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects %p and leaves the line unchanged',
    (raw) => {
      const result = setQuantity(start, 1, raw, MAX);
      expect(result.outcome).toEqual({ type: 'rejected', productId: 1, quantity: 3 });
      expect(result.cart).toBe(start);
    },
  );

  it('never sets a quantity below 1, even if the limit has dropped to 0', () => {
    expect(quantities(setQuantity(start, 1, 2, 0).cart)).toEqual([[1, 1]]);
  });
});

describe('clampToLimits', () => {
  it('lowers only lines above their max, never below 1, and reports each change', () => {
    const start = frozen(cartOf(line(1, 9), line(2, 2), line(3, 4)));
    const max: Record<number, number> = { 1: 5, 2: 10, 3: 0 };

    const { cart, adjustments } = clampToLimits(start, (id) => max[id]);

    expect(quantities(cart)).toEqual([[1, 5], [2, 2], [3, 1]]);
    expect(adjustments).toEqual([
      { productId: 1, from: 9, to: 5 },
      { productId: 3, from: 4, to: 1 },
    ]);
  });

  it('returns the same cart when nothing exceeds its limit', () => {
    const start = frozen(cartOf(line(1, 2)));
    expect(clampToLimits(start, () => 10)).toEqual({ cart: start, adjustments: [] });
    expect(clampToLimits(start, () => 10).cart).toBe(start);
  });
});
