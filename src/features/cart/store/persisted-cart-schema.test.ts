import { line } from '@/test/fixtures/cart';
import { MAX_PERSISTED_LINES, PersistedCartSchema } from './persisted-cart-schema';

const valid = (lines: unknown[]) => PersistedCartSchema.safeParse({ lines }).success;

describe('PersistedCartSchema (FR-012)', () => {
  it('accepts a valid cart, including an empty one', () => {
    expect(valid([line(1, 2), line(2, 10, 0)])).toBe(true);
    expect(valid([])).toBe(true);
  });

  it.each<[string, Record<string, unknown>]>([
    ['productId 0', { productId: 0 }],
    ['productId fractional', { productId: 1.5 }],
    ['quantity 0', { quantity: 0 }],
    ['quantity above the per-line cap', { quantity: 11 }],
    ['quantity fractional', { quantity: 2.5 }],
    ['negative price', { unitPriceCents: -1 }],
    ['fractional (dollar) price', { unitPriceCents: 19.99 }],
    ['price as string', { unitPriceCents: '1999' }],
    ['blank title', { title: '   ' }],
    ['title over 300 chars', { title: 'x'.repeat(301) }],
    ['image on another host', { imageUrl: 'https://evil.example/a.png' }],
    ['image over http', { imageUrl: 'http://fakestoreapi.com/img/a.png' }],
    ['missing field', { title: undefined }],
  ])('rejects the whole cart when one line has %s', (_label, overrides) => {
    expect(valid([line(1, 1), { ...line(2, 1), ...overrides }])).toBe(false);
  });

  it('rejects duplicate productIds outright (no first-wins, unlike the catalogue)', () => {
    expect(valid([line(1, 1), line(1, 2)])).toBe(false);
  });

  it(`rejects more than ${MAX_PERSISTED_LINES} lines`, () => {
    expect(valid(Array.from({ length: MAX_PERSISTED_LINES + 1 }, (_, i) => line(i + 1, 1)))).toBe(false);
  });

  it.each([null, {}, { lines: 'x' }, { lines: [null] }])('rejects malformed payload %p', (payload) => {
    expect(PersistedCartSchema.safeParse(payload).success).toBe(false);
  });
});
