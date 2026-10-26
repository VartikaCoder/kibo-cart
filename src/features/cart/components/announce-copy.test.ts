import { quantityReducedAnnouncement, quantityReducedNote } from './announce-copy';

describe('reduced-quantity copy', () => {
  it.each([
    ['availability', 'Reduced to 4 — limited availability'],
    ['policy', 'Reduced to 4 — limit 10 per order'],
  ] as const)('per-line note for %s', (reason, expected) => {
    expect(quantityReducedNote({ from: 8, to: 4, reason })).toBe(expected);
  });

  it('names the product and both quantities when one line was reduced', () => {
    expect(
      quantityReducedAnnouncement([{ productId: 1, title: 'Backpack', from: 8, to: 4, reason: 'availability' }]),
    ).toBe('Backpack reduced from 8 to 4 — limited availability.');
  });

  it('summarises several reductions in one message', () => {
    const reduction = { title: 'x', from: 8, to: 4, reason: 'availability' } as const;
    expect(quantityReducedAnnouncement([{ productId: 1, ...reduction }, { productId: 2, ...reduction }])).toBe(
      'Quantities reduced for 2 items in your cart. Each item shows why.',
    );
  });
});
