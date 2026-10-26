import type { Cents } from '@/lib/money';

export interface CartLine {
  productId: number;
  /** Integer, 1 ≤ quantity ≤ the line max at the time of the change. */
  quantity: number;
  /** Price snapshot at add time; updated only by reconciliation with a live catalogue (FR-018). */
  unitPriceCents: Cents;
  /** Display snapshots, so the cart renders before the catalogue loads. */
  title: string;
  imageUrl: string;
}

/** Insertion order is display order. Totals are never stored; see selectors. */
export interface Cart {
  readonly lines: readonly CartLine[];
}

export type ProductSnapshot = Pick<CartLine, 'productId' | 'unitPriceCents' | 'title' | 'imageUrl'>;

/**
 * What an operation did. The UI turns outcomes into announcement copy; the domain holds no UI strings.
 * `maxQuantity` is the limit the caller passed in; the domain doesn't know where it came from.
 */
export type CartOutcome =
  | { type: 'added'; productId: number; quantity: number }
  | { type: 'incremented'; productId: number; quantity: number }
  | { type: 'decremented'; productId: number; quantity: number }
  | { type: 'removed'; productId: number }
  | { type: 'updated'; productId: number; quantity: number }
  | { type: 'clamped'; productId: number; quantity: number; requested: number; maxQuantity: number }
  | { type: 'limit-reached'; productId: number; quantity: number; maxQuantity: number }
  | { type: 'rejected'; productId: number; quantity: number }
  | { type: 'unchanged'; productId: number; quantity: number }
  | { type: 'not-found'; productId: number };

/** Every operation returns a new cart, or the same reference when nothing changed. Inputs are never mutated. */
export interface CartResult {
  cart: Cart;
  outcome: CartOutcome;
}
