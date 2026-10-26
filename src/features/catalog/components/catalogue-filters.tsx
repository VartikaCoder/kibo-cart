'use client';

import { useRouter } from 'next/navigation';
import { type ChangeEvent, type FormEvent, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useDebouncedTimer } from '@/lib/use-debounced-timer';
import { type CatalogueQuery, parseCatalogueQuery } from '../schemas/catalogue-query';
import { catalogueHref, serializeCatalogueQuery } from '../query/serialize-catalogue-query';
import { SORT_LABELS } from './sort-options';

export const SEARCH_DEBOUNCE_MS = 300;

type Fields = Pick<CatalogueQuery, 'category' | 'q' | 'sort'>;

interface CatalogueFiltersProps {
  query: CatalogueQuery;
  categories: string[];
}

const fieldClass = 'min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink';
const labelClass = 'mb-1 block text-sm font-medium';

/**
 * Without JS this is a plain GET form. With JS, selects navigate on change (push, so Back works) and
 * search navigates 300 ms after typing stops (replace, so typing doesn't flood history).
 */
export function CatalogueFilters({ query, categories }: CatalogueFiltersProps) {
  const router = useRouter();
  const search = useDebouncedTimer(SEARCH_DEBOUNCE_MS);
  const id = useId();

  // The URL is the source of truth; local state only holds what the user is typing between navigations.
  // When the URL changes (Back, a link), adopt it, but keep in-progress text the URL already reflects
  // (e.g. a trailing space that was trimmed away).
  const urlKey = serializeCatalogueQuery(query);
  const [syncedKey, setSyncedKey] = useState(urlKey);
  const [fields, setFields] = useState<Fields>({ category: query.category, q: query.q, sort: query.sort });
  if (urlKey !== syncedKey) {
    setSyncedKey(urlKey);
    setFields((current) => ({
      category: query.category,
      sort: query.sort,
      q: normalise(current, categories).q === query.q ? current.q : query.q,
    }));
  }

  function navigate(next: Fields, mode: 'push' | 'replace') {
    const target = normalise(next, categories);
    const unchanged = target.category === query.category && target.q === query.q && target.sort === query.sort;
    if (!unchanged) router[mode](catalogueHref(target), { scroll: false });
  }

  function onSearchChange(event: ChangeEvent<HTMLInputElement>) {
    const next = { ...fields, q: event.target.value };
    setFields(next);
    search.schedule(() => navigate(next, 'replace'));
  }

  function onSelectChange(patch: Partial<Fields>) {
    const next = { ...fields, ...patch };
    setFields(next);
    search.cancel(); // `next` already carries the typed text
    navigate(next, 'push');
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    search.cancel();
    navigate(fields, 'push');
  }

  return (
    // role="search" on the form rather than the newer <search> element: same landmark, but also exposed by
    // pre-2023 browsers and by jsdom, which the component tests run in.
    <form
      role="search"
      action="/"
      method="get"
      onSubmit={onSubmit}
      className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
    >
      <div>
        <label htmlFor={`${id}-q`} className={labelClass}>
          Search products
        </label>
        <input
          id={`${id}-q`}
          type="search"
          name="q"
          value={fields.q}
          onChange={onSearchChange}
          autoComplete="off"
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor={`${id}-category`} className={labelClass}>
          Category
        </label>
        <select
          id={`${id}-category`}
          name="category"
          value={fields.category ?? ''}
          onChange={(e) => onSelectChange({ category: e.target.value === '' ? null : e.target.value })}
          className={`${fieldClass} capitalize`}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-sort`} className={labelClass}>
          Sort by
        </label>
        <select
          id={`${id}-sort`}
          name="sort"
          value={fields.sort}
          onChange={(e) => onSelectChange({ sort: normalise({ ...fields, sort: e.target.value }, categories).sort })}
          className={fieldClass}
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <noscript>
        <Button type="submit">Apply</Button>
      </noscript>
    </form>
  );
}

/** Runs form values through the same parser as the URL, so trimming/truncation/validation match. */
function normalise(fields: { category: string | null; q: string; sort: string }, categories: string[]): CatalogueQuery {
  return parseCatalogueQuery({ category: fields.category ?? undefined, q: fields.q, sort: fields.sort }, categories);
}
