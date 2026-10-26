import type { LineLimit } from '@/lib/stock';
import type { CartOutcome } from '../domain/types';
import type { QuantityReduction } from '../store/cart-store';
import { cartAnnouncement, lineLimitLabel, quantityReducedAnnouncement, quantityReducedNote } from './announce-copy';

const reduction = (reason: QuantityReduction['reason'], to: number): QuantityReduction => ({
  productId: 1,
  title: 'Backpack',
  from: 12,
  to,
  reason,
});

describe('limit copy (research R8)', () => {
  it.each([
    ['label', lineLimitLabel({ max: 4, reason: 'availability' }), 'Only 4 available (demo inventory)'],
    ['label', lineLimitLabel({ max: 10, reason: 'policy' }), 'Limit 10 per order'],
    ['note', quantityReducedNote(reduction('availability', 4)), 'Reduced to 4 — only 4 available (demo inventory)'],
    ['note', quantityReducedNote(reduction('policy', 10)), 'Reduced to 10 — limit 10 per order'],
    [
      'announcement',
      quantityReducedAnnouncement([reduction('availability', 4)]),
      'Backpack reduced from 12 to 4 — only 4 available (demo inventory).',
    ],
    ['announcement', quantityReducedAnnouncement([reduction('policy', 10)]), 'Backpack reduced from 12 to 10 — limit 10 per order.'],
  ])('%s: %p', (_kind, actual, expected) => {
    expect(actual).toBe(expected);
  });

  it('marks every availability message as demo inventory, and no policy message', () => {
    const availability = [
      lineLimitLabel({ max: 3, reason: 'availability' }),
      quantityReducedNote(reduction('availability', 3)),
      quantityReducedAnnouncement([reduction('availability', 3)]),
    ];
    const policy = [
      lineLimitLabel({ max: 10, reason: 'policy' }),
      quantityReducedNote(reduction('policy', 10)),
      quantityReducedAnnouncement([reduction('policy', 10)]),
    ];
    availability.forEach((message) => expect(message).toContain('(demo inventory)'));
    policy.forEach((message) => expect(message).not.toMatch(/demo/i));
  });

  it('summarises several reductions in one message', () => {
    expect(quantityReducedAnnouncement([reduction('availability', 4), { ...reduction('policy', 10), productId: 2 }])).toBe(
      'Quantities reduced for 2 items in your cart. Each item shows why.',
    );
  });
});

describe('cartAnnouncement (contracts/ui-components.md)', () => {
  const ctx = { title: 'Mug', itemCount: 3, subtotal: '$12.00' };

  it.each<[CartOutcome, Partial<typeof ctx> & { limit?: LineLimit }, string | null]>([
    [{ type: 'added', productId: 1, quantity: 1 }, {}, 'Mug added to cart. Cart has 3 items.'],
    [{ type: 'added', productId: 1, quantity: 1 }, { itemCount: 1 }, 'Mug added to cart. Cart has 1 item.'],
    [{ type: 'incremented', productId: 1, quantity: 2 }, {}, 'Mug quantity 2. Subtotal $12.00.'],
    [{ type: 'decremented', productId: 1, quantity: 1 }, {}, 'Mug quantity 1. Subtotal $12.00.'],
    [{ type: 'updated', productId: 1, quantity: 4 }, {}, 'Mug quantity 4. Subtotal $12.00.'],
    [{ type: 'removed', productId: 1 }, {}, 'Mug removed from cart.'],
    [{ type: 'limit-reached', productId: 1, quantity: 10, maxQuantity: 10 }, { limit: { max: 10, reason: 'policy' } }, 'Limit of 10 per order reached for Mug.'],
    [{ type: 'limit-reached', productId: 1, quantity: 5, maxQuantity: 5 }, { limit: { max: 5, reason: 'availability' } }, 'Only 5 of Mug available (demo inventory).'],
    [{ type: 'clamped', productId: 1, quantity: 5, requested: 9, maxQuantity: 5 }, {}, 'Quantity for Mug set to 5.'],
    [{ type: 'rejected', productId: 1, quantity: 2 }, {}, 'Quantity for Mug set to 2.'],
    [{ type: 'unchanged', productId: 1, quantity: 2 }, {}, null],
    [{ type: 'not-found', productId: 1 }, {}, null],
  ])('%j → %p', (outcome, overrides, expected) => {
    expect(cartAnnouncement(outcome, { ...ctx, ...overrides })).toBe(expected);
  });
});
