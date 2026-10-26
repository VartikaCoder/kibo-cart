import type { InventoryProvider } from './inventory';

/** Store policy: at most 10 units of one product per order. Holds regardless of inventory. */
export const MAX_QTY_PER_LINE = 10;

export interface LineLimit {
  max: number;
  /** Which rule set the max: the per-line policy, or (simulated) availability. Drives the UI copy. */
  reason: 'policy' | 'availability';
}

/** Effective max = min(policy, availability). Ties report the policy. */
export function getLineLimit(productId: number, inventory: InventoryProvider): LineLimit {
  const available = Math.max(0, Math.floor(inventory.getAvailable(productId)));
  return available < MAX_QTY_PER_LINE
    ? { max: available, reason: 'availability' }
    : { max: MAX_QTY_PER_LINE, reason: 'policy' };
}
