'use client';

import { useCartStore } from '../store/cart-store';

/**
 * The single polite live region for cart changes (FR-017, research R9). Rendered once, in the root layout,
 * so it exists before the first message. Keying the message by id replaces the node each time, so a
 * repeated identical message is announced again.
 */
export function CartAnnouncer() {
  const announcement = useCartStore((s) => s.announcement);
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement && <p key={announcement.id}>{announcement.message}</p>}
    </div>
  );
}
