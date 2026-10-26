import { z } from 'zod';
import {
  type CatalogueQuery,
  DEFAULT_QUERY,
  normaliseSearch,
  type RawSearchParams,
  SORT_KEYS,
} from '../query/catalogue-query';

/**
 * The URL trust boundary for the listing (contracts/url-search-params.md): untyped query params → a valid
 * `CatalogueQuery`. Never throws. Server-side only in practice: Client Components use the Zod-free rules in
 * `query/catalogue-query.ts`, which this schema applies too.
 */

// `.catch()` is right here, unlike the API schema: a bad URL param means "use the default", not "reject".
const SearchSchema = z
  .string()
  .catch(DEFAULT_QUERY.q)
  .transform(normaliseSearch);
const SortSchema = z.enum(SORT_KEYS).catch(DEFAULT_QUERY.sort);
const PageSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(1))
  .catch(DEFAULT_QUERY.page);

export function parseCatalogueQuery(params: RawSearchParams, categories: readonly string[]): CatalogueQuery {
  const category = first(params.category);
  return {
    category: category !== undefined && categories.includes(category) ? category : null,
    q: SearchSchema.parse(first(params.q)),
    sort: SortSchema.parse(first(params.sort)),
    page: PageSchema.parse(first(params.page)),
  };
}

/** Repeated params (`?sort=a&sort=b`) use the first value. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

