import type { Cents } from '@/lib/money';
import { makeProduct, makeProducts } from '@/test/fixtures/products';
import { type CatalogueQuery, DEFAULT_QUERY } from '../query/catalogue-query';
import { applyCatalogueQuery, PAGE_SIZE } from './apply-catalogue-query';

const query = (patch: Partial<CatalogueQuery> = {}): CatalogueQuery => ({ ...DEFAULT_QUERY, ...patch });
const ids = (q: CatalogueQuery, products = catalogue) => applyCatalogueQuery(products, q).items.map((p) => p.id);

const catalogue = [
  makeProduct({ id: 1, title: 'Backpack', priceCents: 10995 as Cents, category: 'bags', rating: { rate: 3.9, count: 120 } }),
  makeProduct({ id: 2, title: 'ankle boots', priceCents: 2230 as Cents, category: 'shoes', rating: { rate: 4.7, count: 5 } }),
  makeProduct({ id: 3, title: 'Cotton Jacket', priceCents: 5599 as Cents, category: 'clothing', rating: { rate: 4.7, count: 500 } }),
  makeProduct({ id: 4, title: 'Écharpe', priceCents: 2230 as Cents, category: 'clothing', rating: { rate: 2.1, count: 9 } }),
  makeProduct({ id: 5, title: '50% off bag & <b>tag</b>', priceCents: 999 as Cents, category: 'bags', rating: { rate: 3, count: 1 } }),
];

describe('applyCatalogueQuery — filter and search', () => {
  it('returns everything in catalogue order by default (featured)', () => {
    expect(ids(query())).toEqual([1, 2, 3, 4, 5]);
  });

  it('filters by exact category', () => {
    expect(ids(query({ category: 'clothing' }))).toEqual([3, 4]);
  });

  it('searches titles case-insensitively', () => {
    expect(ids(query({ q: 'BACK' }))).toEqual([1]);
    expect(ids(query({ q: 'boots' }))).toEqual([2]);
  });

  it('matches search text literally, including regex and HTML characters', () => {
    expect(ids(query({ q: '50% off' }))).toEqual([5]);
    expect(ids(query({ q: '<b>' }))).toEqual([5]);
    expect(ids(query({ q: '.*' }))).toEqual([]);
  });

  it('combines category and search', () => {
    expect(ids(query({ category: 'bags', q: 'bag' }))).toEqual([5]);
    expect(ids(query({ category: 'shoes', q: 'bag' }))).toEqual([]);
  });

  it('reports zero results with a single (empty) page', () => {
    expect(applyCatalogueQuery(catalogue, query({ q: 'nothing matches' }))).toEqual({
      items: [],
      totalItems: 0,
      totalPages: 1,
      page: 1,
    });
  });
});

describe('applyCatalogueQuery — sort', () => {
  it.each<[CatalogueQuery['sort'], number[]]>([
    ['price-asc', [5, 2, 4, 3, 1]],
    ['price-desc', [1, 3, 2, 4, 5]],
    ['rating-asc', [4, 5, 1, 2, 3]],
    ['rating-desc', [2, 3, 1, 5, 4]],
    ['name-asc', [5, 2, 1, 3, 4]],
    ['name-desc', [4, 3, 1, 2, 5]],
  ])('%s', (sort, expected) => {
    expect(ids(query({ sort }))).toEqual(expected);
  });

  it('breaks ties by id ascending in both directions', () => {
    // ids 2 and 4 share a price; ids 2 and 3 share a rating.
    expect(ids(query({ sort: 'price-asc' })).filter((id) => id === 2 || id === 4)).toEqual([2, 4]);
    expect(ids(query({ sort: 'price-desc' })).filter((id) => id === 2 || id === 4)).toEqual([2, 4]);
    expect(ids(query({ sort: 'rating-desc' })).filter((id) => id === 2 || id === 3)).toEqual([2, 3]);
  });

  it('does not reorder the input array', () => {
    const input = [...catalogue];
    applyCatalogueQuery(input, query({ sort: 'price-asc' }));
    expect(input.map((p) => p.id)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('applyCatalogueQuery — pagination', () => {
  const many = makeProducts(30);

  it(`pages at ${PAGE_SIZE} items`, () => {
    const first = applyCatalogueQuery(many, query());
    expect(first).toMatchObject({ totalItems: 30, totalPages: 3, page: 1 });
    expect(first.items.map((p) => p.id)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(applyCatalogueQuery(many, query({ page: 3 })).items.map((p) => p.id)).toEqual(
      Array.from({ length: 6 }, (_, i) => i + 25),
    );
  });

  it('clamps a page beyond the last to the last page', () => {
    const result = applyCatalogueQuery(many, query({ page: 99 }));
    expect(result.page).toBe(3);
    expect(result.items).toHaveLength(6);
  });

  it('paginates after filtering, so page counts reflect the filtered set', () => {
    const result = applyCatalogueQuery(many, query({ category: 'electronics', page: 2 }));
    expect(result).toMatchObject({ totalItems: 10, totalPages: 1, page: 1 });
  });

  it('handles a large catalogue (500 items)', () => {
    const result = applyCatalogueQuery(makeProducts(500), query({ sort: 'price-desc', page: 42 }));
    expect(result).toMatchObject({ totalItems: 500, totalPages: 42, page: 42 });
    expect(result.items.map((p) => p.id)).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
  });
});
