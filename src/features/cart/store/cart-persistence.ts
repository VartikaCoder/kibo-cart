import { CART_STORAGE_KEY } from './cart-storage';
import { type CartStoreApi, type QuantityReduction, useCartStore } from './cart-store';

interface CartPersistenceOptions {
  /** Called after any load that lowered saved quantities, so the UI can announce it. */
  onQuantityReduced?: (reductions: QuantityReduction[]) => void;
}

/**
 * Loads the saved cart and keeps it in sync with other tabs. Call once on the client after mount
 * (`CartHydrator` does this); returns a cleanup function.
 *
 * Cross-tab: browsers fire `storage` only in *other* tabs. Each one re-reads the saved cart through the
 * same validation as a page load. Last write wins: there is no merging. Rehydrating never writes, so
 * there is no echo loop.
 */
export function connectCartPersistence(
  store: CartStoreApi = useCartStore,
  { onQuantityReduced }: CartPersistenceOptions = {},
): () => void {
  let active = true;

  async function load() {
    await store.persist.rehydrate();
    if (!active) return;
    const reductions = store.getState().completeHydration();
    if (reductions.length > 0) onQuantityReduced?.(reductions);
  }

  function onStorage(event: StorageEvent) {
    if (event.storageArea !== window.localStorage) return;
    // `key === null` means another tab called localStorage.clear().
    if (event.key === CART_STORAGE_KEY || event.key === null) void load();
  }

  void load();
  window.addEventListener('storage', onStorage);
  return () => {
    active = false;
    window.removeEventListener('storage', onStorage);
  };
}
