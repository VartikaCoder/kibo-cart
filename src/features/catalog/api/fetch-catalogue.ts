import 'server-only';
import { z } from 'zod';
import { devWarn } from '@/lib/dev-log';
import { ApiProductSchema } from '../schemas/api-product';
import type { Catalogue, Product, SourceFailure } from '../types';
import { CatalogueUnavailableError } from './catalogue-unavailable-error';
import { toProduct } from './to-product';

export const PRODUCTS_URL = 'https://fakestoreapi.com/products';
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * A fallback catalogue. `payload` is raw and untrusted: it goes through the same validation as the live
 * response. `capturedAt` says when it was saved (an ISO timestamp), so the UI can say how old it is.
 */
export interface FallbackData {
  payload: unknown;
  capturedAt: unknown;
}
export type FallbackLoader = () => Promise<FallbackData>;

export interface FetchCatalogueOptions {
  /** `null` disables the fallback, so a live failure surfaces as `CatalogueUnavailableError`. */
  fallback?: FallbackLoader | null;
  timeoutMs?: number;
}

type ReadResult = { ok: true; products: Product[] } | { ok: false; failure: SourceFailure };

export const loadSnapshot: FallbackLoader = async () => {
  const [snapshot, meta] = await Promise.all([import('./snapshot.json'), import('./snapshot.meta.json')]);
  return { payload: snapshot.default, capturedAt: meta.default.capturedAt };
};

const CapturedAtSchema = z.iso.datetime({ offset: true });

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
  let data: FallbackData;
  try {
    data = await fallback();
  } catch (error) {
    throw new CatalogueUnavailableError(live.failure, { kind: 'load-error', message: errorMessage(error) });
  }
  const snapshot = validateProducts(data.payload, 'fallback');
  if (!snapshot.ok) {
    throw new CatalogueUnavailableError(live.failure, snapshot.failure);
  }
  return {
    source: 'snapshot',
    fallbackReason: live.failure,
    // Unknown or malformed → null: the UI then omits the age rather than showing a wrong one.
    capturedAt: CapturedAtSchema.safeParse(data.capturedAt).data ?? null,
    ...withCategories(snapshot.products),
  };
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

/**
 * Per-item safeParse: one bad item is dropped, it never fails the whole response (FR-013).
 * Cart lines are keyed by product id, so only the first valid item per id is kept.
 */
function validateProducts(raw: unknown, label: string): ReadResult {
  if (!Array.isArray(raw)) {
    return { ok: false, failure: { kind: 'not-an-array' } };
  }
  const products: Product[] = [];
  const seenIds = new Set<number>();
  raw.forEach((item: unknown, index) => {
    const parsed = ApiProductSchema.safeParse(item);
    if (!parsed.success) {
      devWarn(`[catalog] dropped invalid ${label} item at index ${index}:`, parsed.error.issues);
    } else if (seenIds.has(parsed.data.id)) {
      devWarn(`[catalog] dropped ${label} item with duplicate id ${parsed.data.id} at index ${index}`);
    } else {
      seenIds.add(parsed.data.id);
      products.push(toProduct(parsed.data));
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
