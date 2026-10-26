import type { LineLimit } from '@/lib/stock';
import { formatMoney } from '@/lib/money';
import { subtotalCents, totalQuantity } from '../domain/selectors';
import type { CartOutcome, ProductSnapshot } from '../domain/types';
import { useCartStore } from '../store/cart-store';
import { cartAnnouncement } from './announce-copy';

/**
 * What the UI calls: run a store action, then announce the outcome through the single live region (FR-017).
 * Plain functions, not hooks: they read the store at call time, so they are stable and safe in any handler.
 */
export const cartCommands = {
  add(product: ProductSnapshot): CartOutcome {
    const { outcome, limit } = useCartStore.getState().addItem(product);
    return announce(outcome, product.title, limit);
  },
  increment(productId: number): CartOutcome {
    const title = titleOf(productId);
    const { outcome, limit } = useCartStore.getState().increment(productId);
    return announce(outcome, title, limit);
  },
  decrement(productId: number): CartOutcome {
    const title = titleOf(productId);
    return announce(useCartStore.getState().decrement(productId), title);
  },
  setQuantity(productId: number, raw: string): CartOutcome {
    const title = titleOf(productId);
    const { outcome, limit } = useCartStore.getState().setQuantity(productId, raw);
    return announce(outcome, title, limit);
  },
  remove(productId: number): CartOutcome {
    const title = titleOf(productId);
    return announce(useCartStore.getState().removeLine(productId), title);
  },
};

/** Read before the action: after a removal the line, and its title, are gone. */
function titleOf(productId: number): string {
  return useCartStore.getState().lines.find((l) => l.productId === productId)?.title ?? '';
}

function announce(outcome: CartOutcome, title: string, limit?: LineLimit): CartOutcome {
  const state = useCartStore.getState();
  const message = cartAnnouncement(outcome, {
    title,
    limit,
    itemCount: totalQuantity(state, state.unavailableIds),
    subtotal: formatMoney(subtotalCents(state, state.unavailableIds)),
  });
  if (message !== null) state.announce(message);
  return outcome;
}
