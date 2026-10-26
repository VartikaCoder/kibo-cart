/**
 * The listing's view state and its rules, with no validation library: safe to import from Client Components
 * without pulling Zod into the browser bundle. The URL trust boundary (`schemas/catalogue-query.ts`) applies
 * these same rules through Zod on the server.
 */

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

export function isSortKey(value: string): value is SortKey {
  return (SORT_KEYS as readonly string[]).includes(value);
}

/** Trim, cap at 100 characters, trim again. Counts code points, so truncation never splits an emoji. */
export function normaliseSearch(q: string): string {
  return Array.from(q.trim()).slice(0, MAX_SEARCH_LENGTH).join('').trim();
}

/**
 * Filter-form values → query (page 1), using the same rules as the URL parser. The form's values come from
 * our own controls, and the server re-validates the URL this produces, so this is not a trust boundary.
 */
export function normaliseFilters(
  fields: { category: string | null; q: string; sort: string },
  categories: readonly string[],
): CatalogueQuery {
  return {
    category: fields.category !== null && categories.includes(fields.category) ? fields.category : null,
    q: normaliseSearch(fields.q),
    sort: isSortKey(fields.sort) ? fields.sort : DEFAULT_QUERY.sort,
    page: DEFAULT_QUERY.page,
  };
}

export function searchParamsToRecord(params: URLSearchParams): RawSearchParams {
  const record: Record<string, string[]> = {};
  params.forEach((value, key) => {
    (record[key] ??= []).push(value);
  });
  return record;
}
