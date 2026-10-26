import {
  type CatalogueQuery,
  DEFAULT_QUERY,
  parseCatalogueQuery,
  SORT_KEYS,
  searchParamsToRecord,
} from '../schemas/catalogue-query';
import { catalogueHref, serializeCatalogueQuery, withQuery } from './serialize-catalogue-query';

const categories = ['electronics', 'jewelery', "men's clothing", "women's clothing"];

describe('serializeCatalogueQuery', () => {
  it('omits every default', () => {
    expect(serializeCatalogueQuery(DEFAULT_QUERY)).toBe('');
    expect(catalogueHref(DEFAULT_QUERY)).toBe('/');
  });

  it('writes params in canonical order: category, q, sort, page', () => {
    expect(serializeCatalogueQuery({ page: 2, sort: 'name-desc', q: 'shirt', category: "men's clothing" })).toBe(
      "category=men%27s+clothing&q=shirt&sort=name-desc&page=2",
    );
  });

  it('encodes special characters rather than letting them break the URL', () => {
    expect(catalogueHref({ ...DEFAULT_QUERY, q: '50% & <b>#x' })).toBe('/?q=50%25+%26+%3Cb%3E%23x');
  });
});

describe('withQuery', () => {
  const onPage3: CatalogueQuery = { category: 'jewelery', q: 'ring', sort: 'price-asc', page: 3 };

  it.each<Partial<CatalogueQuery>>([{ category: null }, { q: 'gold' }, { sort: 'name-asc' }])(
    'resets to page 1 when %p changes',
    (patch) => {
      expect(withQuery(onPage3, patch)).toEqual({ ...onPage3, ...patch, page: 1 });
    },
  );

  it('keeps the page when the patch sets one', () => {
    expect(withQuery(onPage3, { page: 4 })).toEqual({ ...onPage3, page: 4 });
  });
});

describe('URL round trip', () => {
  // Deterministic generator (mulberry32), so a failure is reproducible.
  function rng(seed: number) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const alphabet = ['a', 'Z', ' ', '%', '&', '#', '<', '"', '\\', '.', '*', '+', '=', '?', '/', '🎒', 'é'];

  it('parse(serialize(q)) equals q for 1,000 generated valid queries', () => {
    const random = rng(42);
    const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];

    for (let i = 0; i < 1000; i++) {
      const rawQ = Array.from({ length: Math.floor(random() * 12) }, () => pick(alphabet)).join('');
      const query: CatalogueQuery = {
        category: random() < 0.3 ? null : pick(categories),
        q: rawQ.trim(),
        sort: pick(SORT_KEYS),
        page: 1 + Math.floor(random() * 50),
      };
      const parsed = parseCatalogueQuery(
        searchParamsToRecord(new URLSearchParams(serializeCatalogueQuery(query))),
        categories,
      );
      expect(parsed).toEqual(query);
    }
  });
});
