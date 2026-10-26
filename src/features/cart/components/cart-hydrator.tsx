'use client';

import { useEffect } from 'react';
import { connectCartPersistence } from '../store/cart-persistence';
import { useCartStore } from '../store/cart-store';
import { quantityReducedAnnouncement } from './announce-copy';

/**
 * Loads the saved cart after mount (so server and first client render match) and keeps tabs in sync.
 * If loading lowered any quantity, says so in the live region; each line also shows its own note.
 * Renders nothing. Mounted once, in the root layout.
 */
export function CartHydrator() {
  useEffect(
    () =>
      connectCartPersistence(useCartStore, {
        onQuantityReduced: (reductions) => useCartStore.getState().announce(quantityReducedAnnouncement(reductions)),
      }),
    [],
  );
  return null;
}
