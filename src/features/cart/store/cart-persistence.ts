import { CART_STORAGE_KEY } from './cart-storage';
import { type CartStoreApi, useCartStore } from './cart-store';

/**
 * Loads the saved cart and keeps it in sync with other tabs. Call once on the client after mount
 * (the cart hydrator component does this); returns a cleanup function.
 *
 * Cross-tab: browsers fire `storage` only in *other* tabs. Each one re-reads the saved cart through the
 * same validation as a page load. Last write wins: there is no merging. Rehydrating never writes, so
 * there is no echo loop.
 */
export function connectCartPersistence(store: CartStoreApi = useCartStore): () => void {
  void store.persist.rehydrate();

  function onStorage(event: StorageEvent) {
    if (event.storageArea !== window.localStorage) return;
    // `key === null` means another tab called localStorage.clear().
    if (event.key === CART_STORAGE_KEY || event.key === null) {
      void store.persist.rehydrate();
    }
  }

  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
