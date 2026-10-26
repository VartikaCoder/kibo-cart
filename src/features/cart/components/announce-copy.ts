import { MAX_QTY_PER_LINE } from '@/lib/stock';
import type { QuantityNotice, QuantityReduction } from '../store/cart-store';

/** UI copy for cart events (contracts/ui-components.md). The domain and store hold no strings. */

const REASON: Record<QuantityNotice['reason'], string> = {
  // Availability is SIMULATED (lib/inventory.ts); the README says so. Copy agreed 2026-10-26.
  availability: 'limited availability',
  policy: `limit ${MAX_QTY_PER_LINE} per order`,
};

/** Per-line note, e.g. "Reduced to 4 — limited availability". */
export function quantityReducedNote({ to, reason }: QuantityNotice): string {
  return `Reduced to ${to} — ${REASON[reason]}`;
}

/** One polite announcement for everything lowered by a single load. */
export function quantityReducedAnnouncement(reductions: readonly QuantityReduction[]): string {
  if (reductions.length === 1) {
    const [{ title, from, to, reason }] = reductions;
    return `${title} reduced from ${from} to ${to} — ${REASON[reason]}.`;
  }
  return `Quantities reduced for ${reductions.length} items in your cart. Each item shows why.`;
}
