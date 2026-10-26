import type { Cents } from '@/lib/money';

export interface Product {
  id: number;
  title: string;
  priceCents: Cents;
  description: string;
  category: string;
  imageUrl: string;
  rating: { rate: number; count: number };
}

/** Why a catalogue source could not be used. Plain data so it survives `'use cache'` serialisation. */
export type SourceFailure =
  | { kind: 'http-error'; status: number }
  | { kind: 'network-error'; message: string }
  | { kind: 'timeout' }
  | { kind: 'invalid-json' }
  | { kind: 'not-an-array' }
  | { kind: 'no-valid-items'; received: number }
  | { kind: 'load-error'; message: string }
  | { kind: 'disabled' };

interface CatalogueData {
  products: Product[];
  categories: string[];
}

export type Catalogue =
  | ({ source: 'live' } & CatalogueData)
  /** CATALOGUE_SOURCE=fixture: bundled deterministic data for E2E tests. */
  | ({ source: 'fixture' } & CatalogueData)
  | ({
      source: 'snapshot';
      fallbackReason: SourceFailure;
      /** When the snapshot was saved (ISO 8601), or null if unknown. */
      capturedAt: string | null;
    } & CatalogueData);

export type CatalogueSource = Catalogue['source'];
