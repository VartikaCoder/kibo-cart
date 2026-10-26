import { type LineLimit, MAX_QTY_PER_LINE } from '@/lib/stock';
import type { CartOutcome } from '../domain/types';
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

interface AnnouncementContext {
  title: string;
  /** The limit that applied, for limit-reached outcomes. */
  limit?: LineLimit;
  /** Cart totals after the change. */
  itemCount: number;
  subtotal: string;
}

/** The live-region message for an action's outcome (contracts/ui-components.md), or null for no announcement. */
export function cartAnnouncement(outcome: CartOutcome, { title, limit, itemCount, subtotal }: AnnouncementContext): string | null {
  switch (outcome.type) {
    case 'added':
      return `${title} added to cart. Cart has ${itemCount} ${itemCount === 1 ? 'item' : 'items'}.`;
    case 'incremented':
    case 'decremented':
    case 'updated':
      return `${title} quantity ${outcome.quantity}. Subtotal ${subtotal}.`;
    case 'removed':
      return `${title} removed from cart.`;
    case 'limit-reached':
      return limit?.reason === 'availability'
        ? `Only ${outcome.maxQuantity} of ${title} available ${DEMO_INVENTORY}.`
        : `Limit of ${MAX_QTY_PER_LINE} per order reached for ${title}.`;
    case 'clamped':
    case 'rejected':
      return `Quantity for ${title} set to ${outcome.quantity}.`;
    case 'unchanged':
    case 'not-found':
      return null;
  }
}
