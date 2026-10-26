import { type LineLimit, MAX_QTY_PER_LINE } from '@/lib/stock';
import type { QuantityNotice, QuantityReduction } from '../store/cart-store';

/** UI copy for cart events (contracts/ui-components.md, research R8). The domain and store hold no strings. */

/**
 * Availability comes from SIMULATED inventory (lib/inventory.ts), so every availability message must say so
 * (CLAUDE.md "Stock / inventory"). The per-line policy cap is real and gets no qualifier.
 */
const DEMO_INVENTORY = '(demo inventory)';

/** The standalone limit label, e.g. next to a quantity stepper: "Only 4 available (demo inventory)". */
export function lineLimitLabel({ max, reason }: LineLimit): string {
  return reason === 'availability' ? `Only ${max} available ${DEMO_INVENTORY}` : `Limit ${MAX_QTY_PER_LINE} per order`;
}

/** The same limit, mid-sentence after a dash. For a reduction, the new quantity is the limit. */
function reductionReason({ to, reason }: QuantityNotice): string {
  return reason === 'availability' ? `only ${to} available ${DEMO_INVENTORY}` : `limit ${MAX_QTY_PER_LINE} per order`;
}

/** Per-line note, e.g. "Reduced to 4 — only 4 available (demo inventory)". */
export function quantityReducedNote(notice: QuantityNotice): string {
  return `Reduced to ${notice.to} — ${reductionReason(notice)}`;
}

/** One polite announcement for everything lowered by a single load. */
export function quantityReducedAnnouncement(reductions: readonly QuantityReduction[]): string {
  if (reductions.length === 1) {
    const [reduction] = reductions;
    return `${reduction.title} reduced from ${reduction.from} to ${reduction.to} — ${reductionReason(reduction)}.`;
  }
  return `Quantities reduced for ${reductions.length} items in your cart. Each item shows why.`;
}
