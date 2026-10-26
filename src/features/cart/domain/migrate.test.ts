import { CART_VERSION, migrateCart } from './migrate';

describe('migrateCart', () => {
  it('passes the current version through unchanged (it is validated afterwards)', () => {
    const payload = { lines: [] };
    expect(migrateCart(payload, CART_VERSION)).toBe(payload);
  });

  it.each([0, 2, 99, -1, 1.5, Number.NaN])('returns null for unknown version %p, so the cart starts empty', (version) => {
    expect(migrateCart({ lines: [] }, version)).toBeNull();
  });
});
