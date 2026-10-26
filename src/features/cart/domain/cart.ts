import type { Cart, CartLine, CartResult, ProductSnapshot } from './types';

/** Pure cart operations (data-model §6). No React, no Zustand, no browser APIs. */

export const EMPTY_CART: Cart = { lines: [] };

export function addItem(cart: Cart, product: ProductSnapshot, maxQuantity: number): CartResult {
  const { productId } = product;
  const line = findLine(cart, productId);
  if (line) {
    return line.quantity >= maxQuantity
      ? { cart, outcome: { type: 'limit-reached', productId, quantity: line.quantity, maxQuantity } }
      : withQuantity(cart, line, line.quantity + 1, 'incremented');
  }
  if (maxQuantity < 1) {
    return { cart, outcome: { type: 'limit-reached', productId, quantity: 0, maxQuantity } };
  }
  // Built field by field so extra properties on the caller's object never leak into the cart.
  const newLine: CartLine = {
    productId,
    quantity: 1,
    unitPriceCents: product.unitPriceCents,
    title: product.title,
    imageUrl: product.imageUrl,
  };
  return {
    cart: { lines: [...cart.lines, newLine] },
    outcome: { type: 'added', productId, quantity: 1 },
  };
}

export function increment(cart: Cart, productId: number, maxQuantity: number): CartResult {
  const line = findLine(cart, productId);
  if (!line) return notFound(cart, productId);
  return line.quantity >= maxQuantity
    ? { cart, outcome: { type: 'limit-reached', productId, quantity: line.quantity, maxQuantity } }
    : withQuantity(cart, line, line.quantity + 1, 'incremented');
}

/** At quantity 1, decrementing removes the line (US2-AS3). */
export function decrement(cart: Cart, productId: number): CartResult {
  const line = findLine(cart, productId);
  if (!line) return notFound(cart, productId);
  return line.quantity <= 1 ? removeLine(cart, productId) : withQuantity(cart, line, line.quantity - 1, 'decremented');
}

export function removeLine(cart: Cart, productId: number): CartResult {
  if (!findLine(cart, productId)) return notFound(cart, productId);
  return {
    cart: { lines: cart.lines.filter((l) => l.productId !== productId) },
    outcome: { type: 'removed', productId },
  };
}

/**
 * Direct quantity entry. `raw` is what the user typed: a string must be a whole number (surrounding spaces
 * allowed), a number must be an integer; anything else is rejected and the line is unchanged. Valid values
 * are clamped to [1, maxQuantity].
 */
export function setQuantity(cart: Cart, productId: number, raw: string | number, maxQuantity: number): CartResult {
  const line = findLine(cart, productId);
  if (!line) return notFound(cart, productId);

  const requested = parseWholeNumber(raw);
  if (requested === null) {
    return { cart, outcome: { type: 'rejected', productId, quantity: line.quantity } };
  }
  // A line always keeps at least 1; removal is a separate, explicit action.
  const quantity = Math.max(1, Math.min(requested, maxQuantity));
  const next = quantity === line.quantity ? cart : replaceLine(cart, { ...line, quantity });
  if (quantity !== requested) {
    return { cart: next, outcome: { type: 'clamped', productId, quantity, requested, maxQuantity } };
  }
  return quantity === line.quantity
    ? { cart, outcome: { type: 'unchanged', productId, quantity } }
    : { cart: next, outcome: { type: 'updated', productId, quantity } };
}

export interface QuantityAdjustment {
  productId: number;
  from: number;
  to: number;
}

/**
 * Lowers any quantity above its line's current max (e.g. after loading a saved cart, where the limit may
 * have changed). Never raises a quantity and never removes a line: every line keeps at least 1.
 */
export function clampToLimits(cart: Cart, maxQuantityFor: (productId: number) => number): {
  cart: Cart;
  adjustments: QuantityAdjustment[];
} {
  const adjustments: QuantityAdjustment[] = [];
  const lines = cart.lines.map((line) => {
    const to = Math.max(1, Math.min(line.quantity, maxQuantityFor(line.productId)));
    if (to === line.quantity) return line;
    adjustments.push({ productId: line.productId, from: line.quantity, to });
    return { ...line, quantity: to };
  });
  return { cart: adjustments.length === 0 ? cart : { lines }, adjustments };
}

function findLine(cart: Cart, productId: number): CartLine | undefined {
  return cart.lines.find((l) => l.productId === productId);
}

function replaceLine(cart: Cart, next: CartLine): Cart {
  return { lines: cart.lines.map((l) => (l.productId === next.productId ? next : l)) };
}

function withQuantity(cart: Cart, line: CartLine, quantity: number, type: 'incremented' | 'decremented'): CartResult {
  return {
    cart: replaceLine(cart, { ...line, quantity }),
    outcome: { type, productId: line.productId, quantity },
  };
}

function notFound(cart: Cart, productId: number): CartResult {
  return { cart, outcome: { type: 'not-found', productId } };
}

function parseWholeNumber(raw: string | number): number | null {
  if (typeof raw === 'number') return Number.isSafeInteger(raw) ? raw : null;
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}
