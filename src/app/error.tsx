'use client';

// Error boundaries are Client Components, so this uses the feature's client-safe entry point:
// the main index also exports server-only code.
import { CatalogueError, CatalogueHeading } from '@/features/catalog/client';

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <>
      <CatalogueHeading />
      <CatalogueError onRetry={retry} />
    </>
  );
}
