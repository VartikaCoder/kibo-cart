import type { Cents } from '@/lib/money';
import type { Cart, CartLine } from './types';

/** Derived values. Nothing here is stored (data-model §4–5). Integer cents throughout. */

export function lineTotalCents(line: CartLine): Cents {
  return (line.unitPriceCents * line.quantity) as Cents;
}

/** Sum of quantities. Lines listed in `unavailableIds` don't count (they can only be removed). */
export function totalQuantity(cart: Cart, unavailableIds: readonly number[] = []): number {
  return availableLines(cart, unavailableIds).reduce((sum, line) => sum + line.quantity, 0);
}

export function subtotalCents(cart: Cart, unavailableIds: readonly number[] = []): Cents {
  return availableLines(cart, unavailableIds).reduce((sum, line) => sum + lineTotalCents(line), 0) as Cents;
}

/** 0 when the product isn't in the cart. A primitive, so a product card re-renders only when it changes. */
export function lineQuantity(cart: Cart, productId: number): number {
  return cart.lines.find((l) => l.productId === productId)?.quantity ?? 0;
}

function availableLines(cart: Cart, unavailableIds: readonly number[]): readonly CartLine[] {
  if (unavailableIds.length === 0) return cart.lines;
  const unavailable = new Set(unavailableIds);
  return cart.lines.filter((line) => !unavailable.has(line.productId));
}
