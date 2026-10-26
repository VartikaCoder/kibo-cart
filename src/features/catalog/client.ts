/**
 * Client-safe public surface of the catalog feature: components that can be imported from a Client
 * Component (e.g. `app/error.tsx`). Nothing here may import, directly or transitively, server-only code
 * (`fetchCatalogue`, `getCatalogue`, `next/cache`). `index.ts` re-exports this file; import from here
 * only where the full index can't be used.
 */
export { CatalogueError } from './components/catalogue-error';
export { CatalogueHeading } from './components/catalogue-heading';
