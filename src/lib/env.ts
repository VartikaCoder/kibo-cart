import 'server-only';

export type CatalogueSourceMode = 'live' | 'fixture';

/**
 * `CATALOGUE_SOURCE` (server-only). Unset → `live`. `fixture` serves a bundled, deterministic catalogue for
 * E2E tests (contracts/catalogue-api.md). Any other value is a configuration error, so it throws rather than
 * quietly serving live data to a test run that asked for a fixture.
 */
export function catalogueSourceMode(env: Record<string, string | undefined> = process.env): CatalogueSourceMode {
  const value = env.CATALOGUE_SOURCE;
  if (value === undefined || value === '') return 'live';
  if (value === 'fixture') return 'fixture';
  throw new Error(`Unknown CATALOGUE_SOURCE "${value}". Expected unset or "fixture".`);
}
