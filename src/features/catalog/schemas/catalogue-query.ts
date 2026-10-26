import { z } from 'zod';

/** Listing view state, parsed from the URL (contracts/url-search-params.md). Never throws. */

export const SORT_KEYS = [
  'featured',
  'price-asc',
  'price-desc',
  'rating-asc',
  'rating-desc',
  'name-asc',
  'name-desc',
] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const MAX_SEARCH_LENGTH = 100;

export interface CatalogueQuery {
  category: string | null;
  q: string;
  sort: SortKey;
  page: number;
}

export const DEFAULT_QUERY: CatalogueQuery = { category: null, q: '', sort: 'featured', page: 1 };

export type RawSearchParams = Record<string, string | string[] | undefined>;

// `.catch()` is right here, unlike the API schema: a bad URL param means "use the default", not "reject".
const SearchSchema = z
  .string()
  .catch('')
  // Count code points, not UTF-16 units, so truncation never splits an emoji.
  .transform((q) => Array.from(q.trim()).slice(0, MAX_SEARCH_LENGTH).join('').trim());
const SortSchema = z.enum(SORT_KEYS).catch('featured');
const PageSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(1))
  .catch(1);

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

export function searchParamsToRecord(params: URLSearchParams): RawSearchParams {
  const record: Record<string, string[]> = {};
  params.forEach((value, key) => {
    (record[key] ??= []).push(value);
  });
  return record;
}
