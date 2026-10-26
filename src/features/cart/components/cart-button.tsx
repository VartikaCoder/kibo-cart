'use client';

import { CartIcon } from '@/components/ui/icons';
import { totalQuantity } from '../domain/selectors';
import { useCartStore } from '../store/cart-store';

export const CART_DRAWER_ID = 'cart-drawer';

/**
 * Header button that opens the cart. Before the saved cart has loaded it shows no number at all, rather than
 * a misleading 0 (US3-AS4).
 */
export function CartButton() {
  const hydrated = useCartStore((s) => s.hydrated);
  const count = useCartStore((s) => totalQuantity(s, s.unavailableIds));
  const open = useCartStore((s) => s.drawerOpen);
  const setDrawerOpen = useCartStore((s) => s.setDrawerOpen);

  return (
    <button
      type="button"
      aria-label={hydrated ? `Cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Cart'}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={CART_DRAWER_ID}
      onClick={() => setDrawerOpen(true)}
      className="relative inline-flex size-11 items-center justify-center rounded-md hover:bg-canvas"
    >
      <CartIcon />
      <span
        aria-hidden="true"
        className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold text-accent-ink tabular-nums"
      >
        {hydrated ? count : ''}
      </span>
    </button>
  );
}
