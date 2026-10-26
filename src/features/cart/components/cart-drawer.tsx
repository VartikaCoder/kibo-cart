'use client';

import { useRef } from 'react';
import { flushSync } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/lib/money';
import { subtotalCents, totalQuantity } from '../domain/selectors';
import { useCartStore } from '../store/cart-store';
import { CART_DRAWER_ID } from './cart-button';
import { cartCommands } from './cart-commands';
import { CartLineItem } from './cart-line-item';

export function CartDrawer() {
  const open = useCartStore((s) => s.drawerOpen);
  const setDrawerOpen = useCartStore((s) => s.setDrawerOpen);
  const hydrated = useCartStore((s) => s.hydrated);
  const productIds = useCartStore(useShallow((s) => s.lines.map((l) => l.productId)));
  const listRef = useRef<HTMLUListElement>(null);
  const emptyRef = useRef<HTMLDivElement>(null);
  const close = () => setDrawerOpen(false);

  /**
   * Removing a line deletes the focused button, so place focus deliberately (contracts/ui-components.md):
   * the next line's Remove button, else the previous line's, else the empty-cart message.
   */
  function removeLine(productId: number) {
    const index = productIds.indexOf(productId);
    const outcome = flushSync(() => cartCommands.remove(productId));
    if (outcome.type !== 'removed') return;

    const remaining = useCartStore.getState().lines.map((l) => l.productId);
    const target = remaining[index] ?? remaining[index - 1];
    if (target === undefined) {
      emptyRef.current?.focus();
    } else {
      listRef.current?.querySelector<HTMLElement>(`[data-remove-for="${target}"]`)?.focus();
    }
  }

  return (
    <Drawer id={CART_DRAWER_ID} open={open} onClose={close} title="Your cart" closeLabel="Close cart">
      {!hydrated ? (
        <div className="flex flex-col gap-3 p-4" aria-busy="true">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : productIds.length === 0 ? (
        <div ref={emptyRef} tabIndex={-1} className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-ink-muted">Your cart is empty.</p>
          <Button variant="secondary" onClick={close}>
            Continue shopping
          </Button>
        </div>
      ) : (
        <>
          <ul ref={listRef} role="list" className="min-h-0 flex-1 overflow-y-auto">
            {productIds.map((id) => (
              <CartLineItem key={id} productId={id} onRemove={removeLine} />
            ))}
          </ul>
          <CartTotals />
        </>
      )}
    </Drawer>
  );
}

/** Derived on every render from the lines; never stored (FR-009, FR-010). */
function CartTotals() {
  const count = useCartStore((s) => totalQuantity(s, s.unavailableIds));
  const subtotal = useCartStore((s) => subtotalCents(s, s.unavailableIds));

  return (
    <dl className="grid grid-cols-[1fr_auto] gap-1 border-t border-border p-4 text-sm">
      <dt className="text-ink-muted">Items</dt>
      <dd className="text-right tabular-nums">{count}</dd>
      <dt className="font-semibold">Subtotal</dt>
      <dd className="text-right font-semibold tabular-nums">{formatMoney(subtotal)}</dd>
    </dl>
  );
}
