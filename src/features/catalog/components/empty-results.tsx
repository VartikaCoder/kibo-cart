import Link from 'next/link';
import { buttonClassName } from '@/components/ui/button';
import type { CatalogueQuery } from '../query/catalogue-query';

export function EmptyResults({ query }: { query: CatalogueQuery }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">No products found</h2>
      <p className="max-w-md text-ink-muted">
        {query.q === ''
          ? 'No products match the selected filters.'
          : `No products match “${query.q}” with the selected filters.`}
      </p>
      <Link href="/" className={buttonClassName('secondary')}>
        Clear filters
      </Link>
    </div>
  );
}
