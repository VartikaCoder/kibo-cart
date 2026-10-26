import type { CatalogueSource } from '../types';
import { type CatalogueResult, PAGE_SIZE } from '../query/apply-catalogue-query';
import type { CatalogueQuery } from '../query/catalogue-query';
import { CatalogueFilters } from './catalogue-filters';
import { EmptyResults } from './empty-results';
import { Pagination } from './pagination';
import { ProductGrid } from './product-grid';
import { ResultSummary } from './result-summary';
import { type SnapshotAge, SnapshotNotice } from './snapshot-notice';

interface ProductListingProps {
  source: CatalogueSource;
  categories: string[];
  query: CatalogueQuery;
  result: CatalogueResult;
  retryAction: () => Promise<void>;
  /** Formatted on the server; only used when `source` is `'snapshot'`. */
  snapshotAge?: SnapshotAge | null;
}

export function ProductListing({ source, categories, query, result, retryAction, snapshotAge = null }: ProductListingProps) {
  const current = { ...query, page: result.page };

  return (
    <div className="flex flex-col gap-6">
      {source === 'snapshot' && <SnapshotNotice retryAction={retryAction} age={snapshotAge} />}
      <CatalogueFilters query={current} categories={categories} />
      <ResultSummary result={result} pageSize={PAGE_SIZE} />
      {result.items.length === 0 ? <EmptyResults query={current} /> : <ProductGrid products={result.items} />}
      <Pagination page={result.page} totalPages={result.totalPages} query={current} />
    </div>
  );
}
