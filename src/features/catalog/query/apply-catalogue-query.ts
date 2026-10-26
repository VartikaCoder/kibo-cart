import type { CatalogueQuery, SortKey } from '../schemas/catalogue-query';
import type { Product } from '../types';

export const PAGE_SIZE = 12;

export interface CatalogueResult {
  items: Product[];
  totalItems: number;
  totalPages: number;
  /** The requested page clamped to `[1, totalPages]`. */
  page: number;
}

type Compare = (a: Product, b: Product) => number;

const collator = new Intl.Collator('en');
const byId: Compare = (a, b) => a.id - b.id;

// Ties are broken by id ascending so every sort is deterministic (data-model §3).
const comparators: Record<Exclude<SortKey, 'featured'>, Compare> = {
  'price-asc': (a, b) => a.priceCents - b.priceCents || byId(a, b),
  'price-desc': (a, b) => b.priceCents - a.priceCents || byId(a, b),
  'rating-asc': (a, b) => a.rating.rate - b.rating.rate || byId(a, b),
  'rating-desc': (a, b) => b.rating.rate - a.rating.rate || byId(a, b),
  'name-asc': (a, b) => collator.compare(a.title, b.title) || byId(a, b),
  'name-desc': (a, b) => collator.compare(b.title, a.title) || byId(a, b),
};

/** Filter → search → sort → paginate. `featured` keeps catalogue order. */
export function applyCatalogueQuery(
  products: readonly Product[],
  query: CatalogueQuery,
  pageSize: number = PAGE_SIZE,
): CatalogueResult {
  const needle = query.q.toLocaleLowerCase('en');
  const matching = products.filter(
    (p) =>
      (query.category === null || p.category === query.category) &&
      (needle === '' || p.title.toLocaleLowerCase('en').includes(needle)),
  );
  const sorted = query.sort === 'featured' ? matching : matching.toSorted(comparators[query.sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * pageSize;
  return { items: sorted.slice(start, start + pageSize), totalItems: sorted.length, totalPages, page };
}
