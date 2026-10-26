/**
 * SIMULATED INVENTORY. fakestoreapi has no stock data, so availability here is invented for the demo.
 *
 * It is deterministic per product id (same on server and client, same on every run) so it causes no hydration
 * mismatch and no flaky tests. A real inventory API would replace only `simulatedInventory`; callers depend
 * on `InventoryProvider`. UI copy that uses this value must say it is demo inventory.
 */
export interface InventoryProvider {
  /** Units available for this product. */
  getAvailable(productId: number): number;
}

const MIN_SIMULATED = 3;
const MAX_SIMULATED = 20;

export const simulatedInventory: InventoryProvider = {
  getAvailable(productId) {
    // Knuth multiplicative hash: spreads consecutive ids across the range.
    const hash = Math.imul(productId, 2654435761) >>> 0;
    return MIN_SIMULATED + (hash % (MAX_SIMULATED - MIN_SIMULATED + 1));
  },
};
