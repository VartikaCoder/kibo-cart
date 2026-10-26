import type { SourceFailure } from '../types';

/** Every catalogue source failed. Rendered by `app/error.tsx` with a retry. */
export class CatalogueUnavailableError extends Error {
  override readonly name = 'CatalogueUnavailableError';

  constructor(
    readonly liveFailure: SourceFailure,
    readonly fallbackFailure: SourceFailure,
  ) {
    super(`Catalogue unavailable (live: ${liveFailure.kind}, fallback: ${fallbackFailure.kind})`);
  }
}
