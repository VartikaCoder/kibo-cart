import {
  applyCatalogueQuery,
  CatalogueHeading,
  getCatalogue,
  parseCatalogueQuery,
  ProductListing,
  refreshCatalogue,
} from '@/features/catalog';

export default async function HomePage({ searchParams }: PageProps<'/'>) {
  const [catalogue, params] = await Promise.all([getCatalogue(), searchParams]);
  const query = parseCatalogueQuery(params, catalogue.categories);
  const result = applyCatalogueQuery(catalogue.products, query);

  return (
    <>
      <CatalogueHeading />
      <ProductListing
        source={catalogue.source}
        categories={catalogue.categories}
        query={query}
        result={result}
        retryAction={refreshCatalogue}
      />
    </>
  );
}
