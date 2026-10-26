import { connection } from 'next/server';
import {
  applyCatalogueQuery,
  CatalogueHeading,
  getCatalogue,
  parseCatalogueQuery,
  ProductListing,
  refreshCatalogue,
  type SnapshotAge,
} from '@/features/catalog';
import { formatRelativeAge, formatUtcTimestamp } from '@/lib/relative-time';

export default async function HomePage({ searchParams }: PageProps<'/'>) {
  const [catalogue, params] = await Promise.all([getCatalogue(), searchParams]);
  const query = parseCatalogueQuery(params, catalogue.categories);
  const result = applyCatalogueQuery(catalogue.products, query);
  const snapshotAge =
    catalogue.source === 'snapshot' && catalogue.capturedAt !== null
      ? await describeAge(catalogue.capturedAt)
      : null;

  return (
    <>
      <CatalogueHeading />
      <ProductListing
        source={catalogue.source}
        categories={catalogue.categories}
        query={query}
        result={result}
        retryAction={refreshCatalogue}
        snapshotAge={snapshotAge}
      />
    </>
  );
}

/**
 * Reads the clock once, on the server, at request time (`connection()` keeps it out of any prerender), and
 * formats there. The client receives finished strings, so its first render matches the server's.
 */
async function describeAge(capturedAt: string): Promise<SnapshotAge> {
  await connection();
  const then = new Date(capturedAt);
  return { relative: formatRelativeAge(then, new Date()), absolute: formatUtcTimestamp(then), iso: capturedAt };
}
