import type { Cents } from '@/lib/money';
import type { Cart } from './types';

export interface PriceChange {
  productId: number;
  fromCents: Cents;
  toCents: Cents;
}

export interface Reconciliation {
  cart: Cart;
  priceChanges: PriceChange[];
  /** Cart lines whose product is not in the catalogue. Reported, not removed: the shopper decides. */
  missingIds: number[];
}

/**
 * Brings line prices up to date with the catalogue (FR-018). Only meaningful for an authoritative catalogue:
 * the caller must not pass a snapshot catalogue's prices (research R3/R7).
 */
export function reconcileWithCatalogue(cart: Cart, prices: ReadonlyMap<number, Cents>): Reconciliation {
  const priceChanges: PriceChange[] = [];
  const missingIds: number[] = [];

  const lines = cart.lines.map((line) => {
    const current = prices.get(line.productId);
    if (current === undefined) {
      missingIds.push(line.productId);
      return line;
    }
    if (current === line.unitPriceCents) return line;
    priceChanges.push({ productId: line.productId, fromCents: line.unitPriceCents, toCents: current });
    return { ...line, unitPriceCents: current };
  });

  return { cart: priceChanges.length === 0 ? cart : { lines }, priceChanges, missingIds };
}
