import { apiProduct } from '@/test/msw/handlers';
import snapshot from '../api/snapshot.json';
import { ApiProductSchema } from './api-product';

describe('ApiProductSchema', () => {
  it('accepts every item in the captured live response', () => {
    const failures = snapshot.filter((item) => !ApiProductSchema.safeParse(item).success);
    expect(failures).toEqual([]);
  });

  it('strips unknown keys rather than passing them through, so no invented field (e.g. stock) reaches the app', () => {
    const parsed = ApiProductSchema.parse(apiProduct({ stock: 5, discount: 0.5 }));
    expect(parsed).not.toHaveProperty('stock');
    expect(parsed).not.toHaveProperty('discount');
    expect(Object.keys(parsed).sort()).toEqual(
      ['category', 'description', 'id', 'image', 'price', 'rating', 'title'],
    );
  });

  it('keeps a title containing markup as plain text (rendering escapes it; FR-014)', () => {
    const parsed = ApiProductSchema.parse(apiProduct({ title: '<script>alert(1)</script>' }));
    expect(parsed.title).toBe('<script>alert(1)</script>');
  });

  it.each<[string, Record<string, unknown>]>([
    ['id missing', { id: undefined }],
    ['id zero', { id: 0 }],
    ['id fractional', { id: 1.5 }],
    ['id as string', { id: '1' }],
    ['title empty', { title: '' }],
    ['title whitespace only', { title: '   ' }],
    ['price missing', { price: undefined }],
    ['price negative', { price: -1 }],
    ['price NaN', { price: Number.NaN }],
    ['price Infinity', { price: Number.POSITIVE_INFINITY }],
    ['price as string', { price: '19.99' }],
    ['description missing', { description: undefined }],
    ['category empty', { category: '' }],
    ['image not a URL', { image: 'not a url' }],
    ['image over http', { image: 'http://fakestoreapi.com/img/a.png' }],
    ['image on another host', { image: 'https://evil.example/img/a.png' }],
    ['image on a look-alike host', { image: 'https://fakestoreapi.com.evil.example/a.png' }],
    ['image javascript: URL', { image: 'javascript:alert(1)' }],
    ['rating missing', { rating: undefined }],
    ['rating.rate above 5', { rating: { rate: 5.1, count: 1 } }],
    ['rating.rate negative', { rating: { rate: -0.1, count: 1 } }],
    ['rating.count fractional', { rating: { rate: 4, count: 1.5 } }],
    ['rating.count missing', { rating: { rate: 4 } }],
  ])('rejects an item with %s (no default is substituted)', (_label, overrides) => {
    expect(ApiProductSchema.safeParse(apiProduct(overrides)).success).toBe(false);
  });

  it.each([null, 'product', 42, []])('rejects a non-object item %p', (item) => {
    expect(ApiProductSchema.safeParse(item).success).toBe(false);
  });
});
