import type { Cart, CartLine, ProductSnapshot } from '@/features/cart';
import type { Cents } from '@/lib/money';

export function snapshot(productId: number, unitPriceCents = 1000): ProductSnapshot {
  return {
    productId,
    unitPriceCents: unitPriceCents as Cents,
    title: `Product ${productId}`,
    imageUrl: `https://fakestoreapi.com/img/${productId}.png`,
  };
}

export function line(productId: number, quantity: number, unitPriceCents = 1000): CartLine {
  return { ...snapshot(productId, unitPriceCents), quantity };
}

export function cartOf(...lines: CartLine[]): Cart {
  return { lines };
}

/** Deep-freezes a cart so a test fails loudly if an operation mutates its input. */
export function frozen(cart: Cart): Cart {
  cart.lines.forEach((l) => Object.freeze(l));
  Object.freeze(cart.lines);
  return Object.freeze(cart);
}
