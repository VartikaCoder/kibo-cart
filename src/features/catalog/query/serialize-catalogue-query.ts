import { type CatalogueQuery, DEFAULT_QUERY } from '../schemas/catalogue-query';

/** Canonical order category, q, sort, page; defaults omitted. Always built with URLSearchParams. */
export function serializeCatalogueQuery(query: CatalogueQuery): string {
  const params = new URLSearchParams();
  if (query.category !== null) params.set('category', query.category);
  if (query.q !== DEFAULT_QUERY.q) params.set('q', query.q);
  if (query.sort !== DEFAULT_QUERY.sort) params.set('sort', query.sort);
  if (query.page !== DEFAULT_QUERY.page) params.set('page', String(query.page));
  return params.toString();
}

export function catalogueHref(query: CatalogueQuery): string {
  const search = serializeCatalogueQuery(query);
  return search === '' ? '/' : `/?${search}`;
}

/** Changing category, search, or sort resets to page 1 unless the patch sets a page. */
export function withQuery(current: CatalogueQuery, patch: Partial<CatalogueQuery>): CatalogueQuery {
  return { ...current, page: DEFAULT_QUERY.page, ...patch };
}
