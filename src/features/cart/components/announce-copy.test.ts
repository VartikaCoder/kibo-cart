import type { QuantityReduction } from '../store/cart-store';
import { lineLimitLabel, quantityReducedAnnouncement, quantityReducedNote } from './announce-copy';

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
