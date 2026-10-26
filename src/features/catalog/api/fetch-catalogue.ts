import 'server-only';
import { devWarn } from '@/lib/dev-log';
import { ApiProductSchema } from '../schemas/api-product';
import type { Catalogue, Product, SourceFailure } from '../types';
import { CatalogueUnavailableError } from './catalogue-unavailable-error';
import { toProduct } from './to-product';

export const PRODUCTS_URL = 'https://fakestoreapi.com/products';
const DEFAULT_TIMEOUT_MS = 5000;

/** Returns the raw, still-untrusted fallback payload. It goes through the same validation as the live response. */
export type FallbackLoader = () => Promise<unknown>;

export interface FetchCatalogueOptions {
  /** `null` disables the fallback, so a live failure surfaces as `CatalogueUnavailableError`. */
  fallback?: FallbackLoader | null;
  timeoutMs?: number;
}

type ReadResult = { ok: true; products: Product[] } | { ok: false; failure: SourceFailure };

export const loadSnapshot: FallbackLoader = async () => (await import('./snapshot.json')).default;

/** Uncached. Live → snapshot → `CatalogueUnavailableError` (research R3, contracts/catalogue-api.md). */
export async function fetchCatalogue({
  fallback = loadSnapshot,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: FetchCatalogueOptions = {}): Promise<Catalogue> {
  const live = await readLive(timeoutMs);
  if (live.ok) {
    return { source: 'live', ...withCategories(live.products) };
  }
  devWarn('[catalog] live source failed, trying fallback:', live.failure);

  if (fallback === null) {
    throw new CatalogueUnavailableError(live.failure, { kind: 'disabled' });
  }
  const snapshot = await readFallback(fallback);
  if (!snapshot.ok) {
    throw new CatalogueUnavailableError(live.failure, snapshot.failure);
  }
  return { source: 'snapshot', fallbackReason: live.failure, ...withCategories(snapshot.products) };
}

async function readLive(timeoutMs: number): Promise<ReadResult> {
  let response: Response;
  try {
    response = await fetch(PRODUCTS_URL, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return { ok: false, failure: { kind: 'timeout' } };
    }
    return { ok: false, failure: { kind: 'network-error', message: errorMessage(error) } };
  }
  if (!response.ok) {
    return { ok: false, failure: { kind: 'http-error', status: response.status } };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, failure: { kind: 'invalid-json' } };
  }
  return validateProducts(body, 'live');
}

async function readFallback(load: FallbackLoader): Promise<ReadResult> {
  let raw: unknown;
  try {
    raw = await load();
  } catch (error) {
    return { ok: false, failure: { kind: 'load-error', message: errorMessage(error) } };
  }
  return validateProducts(raw, 'fallback');
}

/** Per-item safeParse: one bad item is dropped, it never fails the whole response (FR-013). */
function validateProducts(raw: unknown, label: string): ReadResult {
  if (!Array.isArray(raw)) {
    return { ok: false, failure: { kind: 'not-an-array' } };
  }
  const products: Product[] = [];
  raw.forEach((item: unknown, index) => {
    const parsed = ApiProductSchema.safeParse(item);
    if (parsed.success) {
      products.push(toProduct(parsed.data));
    } else {
      devWarn(`[catalog] dropped invalid ${label} item at index ${index}:`, parsed.error.issues);
    }
  });
  if (products.length === 0) {
    return { ok: false, failure: { kind: 'no-valid-items', received: raw.length } };
  }
  return { ok: true, products };
}

function withCategories(products: Product[]) {
  const categories = [...new Set(products.map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'en'));
  return { products, categories };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
