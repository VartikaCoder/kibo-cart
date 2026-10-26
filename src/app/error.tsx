'use client';

import { CatalogueError } from '@/features/catalog/components/catalogue-error';
import { CatalogueHeading } from '@/features/catalog/components/catalogue-heading';

// Error boundaries must be Client Components, so this imports the two client-safe leaves directly
// rather than through the feature index (which also exports server-only code).
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <>
      <CatalogueHeading />
      <CatalogueError onRetry={retry} />
    </>
  );
}
