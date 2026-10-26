import { DEFAULT_QUERY, parseCatalogueQuery, searchParamsToRecord } from './catalogue-query';

const categories = ['electronics', 'jewelery', "men's clothing"];

describe('parseCatalogueQuery', () => {
  it('returns defaults for an empty URL', () => {
    expect(parseCatalogueQuery({}, categories)).toEqual(DEFAULT_QUERY);
  });

  it('reads every valid param', () => {
    expect(
      parseCatalogueQuery({ category: 'jewelery', q: 'ring', sort: 'price-desc', page: '3' }, categories),
    ).toEqual({ category: 'jewelery', q: 'ring', sort: 'price-desc', page: 3 });
  });

  it.each([
    ['unknown category', { category: 'toys' }, { category: null }],
    ['category with different case', { category: 'Electronics' }, { category: null }],
    ['unknown sort', { sort: 'cheapest' }, { sort: 'featured' }],
    ['page zero', { page: '0' }, { page: 1 }],
    ['negative page', { page: '-2' }, { page: 1 }],
    ['fractional page', { page: '2.5' }, { page: 1 }],
    ['non-numeric page', { page: 'two' }, { page: 1 }],
    ['exponent page', { page: '1e3' }, { page: 1 }],
    ['empty page', { page: '' }, { page: 1 }],
  ])('falls back to the default for %s', (_label, params, expected) => {
    expect(parseCatalogueQuery(params, categories)).toEqual({ ...DEFAULT_QUERY, ...expected });
  });

  it('uses the first value of a repeated param', () => {
    expect(parseCatalogueQuery({ sort: ['name-asc', 'price-asc'], q: ['a', 'b'] }, categories)).toMatchObject({
      sort: 'name-asc',
      q: 'a',
    });
  });

  it('trims search text and treats whitespace-only as empty', () => {
    expect(parseCatalogueQuery({ q: '  bag  ' }, categories).q).toBe('bag');
    expect(parseCatalogueQuery({ q: '   ' }, categories).q).toBe('');
  });

  it('truncates search text to 100 characters without splitting an emoji', () => {
    expect(parseCatalogueQuery({ q: 'a'.repeat(150) }, categories).q).toHaveLength(100);
    const emoji = parseCatalogueQuery({ q: '🎒'.repeat(120) }, categories).q;
    expect(Array.from(emoji)).toHaveLength(100);
    expect(Array.from(emoji).every((c) => c === '🎒')).toBe(true);
  });

  it('keeps special characters as literal text', () => {
    expect(parseCatalogueQuery({ q: '50% & <b>"\\.*' }, categories).q).toBe('50% & <b>"\\.*');
  });
});

describe('searchParamsToRecord', () => {
  it('keeps repeated keys so the parser can take the first', () => {
    const record = searchParamsToRecord(new URLSearchParams('sort=name-asc&sort=price-asc&q=a'));
    expect(parseCatalogueQuery(record, categories)).toMatchObject({ sort: 'name-asc', q: 'a' });
  });
});
