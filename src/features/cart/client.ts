/**
 * Client-safe public surface of the cart feature. Everything here may be imported from Client Components.
 * `index.ts` re-exports this file.
 */
export { lineQuantity, lineTotalCents, subtotalCents, totalQuantity } from './domain/selectors';
export type { Cart, CartLine, CartOutcome, ProductSnapshot } from './domain/types';
export type { PriceChange, Reconciliation } from './domain/reconcile';
export { connectCartPersistence } from './store/cart-persistence';
export { useCartStore } from './store/cart-store';
export type { Announcement, CartState, CartStore, LimitedOutcome, PriceNotice } from './store/cart-store';
