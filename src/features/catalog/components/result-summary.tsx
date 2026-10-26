import type { CatalogueResult } from '../query/apply-catalogue-query';

/** Polite status, so a screen reader hears the new count after a search or filter (contracts/ui-components.md). */
export function ResultSummary({ result, pageSize }: { result: CatalogueResult; pageSize: number }) {
  const { totalItems, page } = result;
  const first = (page - 1) * pageSize + 1;
  const last = first + result.items.length - 1;
  const noun = totalItems === 1 ? 'product' : 'products';

  return (
    <p role="status" className="text-sm text-ink-muted">
      {totalItems === 0
        ? 'No products found'
        : totalItems <= pageSize
          ? `${totalItems} ${noun}`
          : `Showing ${first}–${last} of ${totalItems} ${noun}`}
    </p>
  );
}
