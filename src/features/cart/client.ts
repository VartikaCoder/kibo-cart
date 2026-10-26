/**
 * Client-safe public surface of the cart feature. Everything here may be imported from Client Components.
 * `index.ts` re-exports this file.
 */
export { lineQuantity, lineTotalCents, subtotalCents, totalQuantity } from './domain/selectors';
export type { Cart, CartLine, CartOutcome, ProductSnapshot } from './domain/types';
export type { PriceChange, Reconciliation } from './domain/reconcile';
export { connectCartPersistence } from './store/cart-persistence';
export { useCartStore } from './store/cart-store';
export type {
  Announcement,
  CartState,
  CartStore,
  LimitedOutcome,
  PriceNotice,
  QuantityNotice,
  QuantityReduction,
} from './store/cart-store';
export { lineLimitLabel, quantityReducedNote } from './components/announce-copy';
export { CartAnnouncer } from './components/cart-announcer';
export { CartHydrator } from './components/cart-hydrator';
export { AddToCartControl } from './components/add-to-cart-control';
export { CartButton } from './components/cart-button';
export { CartDrawer } from './components/cart-drawer';
