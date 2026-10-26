import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { devWarn } from '@/lib/dev-log';
import { CART_VERSION, migrateCart } from '../domain/migrate';
import type { CartLine } from '../domain/types';
import { type PersistedCart, PersistedCartSchema } from './persisted-cart-schema';

export const CART_STORAGE_KEY = 'kibo-cart';

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * The zustand `persist` storage for the cart. It is the trust boundary for saved data:
 * - Read: parse → migrate → validate. Any failure removes the key and yields an empty cart, never `null`
 *   (with `null`, zustand would keep the current lines, so a cart cleared in another tab would survive here).
 * - Write: skipped when the stored cart wouldn't change. zustand writes on every `setState`, including
 *   UI-only state (drawer, announcements); skipping keeps it to one write per cart change, and means
 *   rehydrating never echoes a write back to other tabs.
 * - Storage errors (private mode, quota) are caught; the cart keeps working in memory.
 */
export function createCartStorage(getStorage: () => BrowserStorage | undefined): PersistStorage<PersistedCart> {
  function read(name: string): string | null {
    try {
      return getStorage()?.getItem(name) ?? null;
    } catch (error) {
      devWarn('[cart] could not read saved cart:', error);
      return null;
    }
  }

  function remove(name: string): void {
    try {
      getStorage()?.removeItem(name);
    } catch (error) {
      devWarn('[cart] could not remove saved cart:', error);
    }
  }

  return {
    getItem(name) {
      const raw = read(name);
      if (raw === null) return emptyCart();
      const lines = parseSavedCart(raw);
      if (lines === null) {
        remove(name);
        return emptyCart();
      }
      return { state: { lines }, version: CART_VERSION };
    },

    setItem(name, value) {
      const current = read(name);
      const next = serialise(value.state.lines);
      if (next === current) return;
      if (current === null && value.state.lines.length === 0) return; // an empty cart needs no key
      try {
        getStorage()?.setItem(name, next);
      } catch (error) {
        devWarn('[cart] could not save cart; changes will last only for this page:', error);
      }
    },

    removeItem: remove,
  };
}

function parseSavedCart(raw: string): CartLine[] | null {
  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    devWarn('[cart] discarded saved cart: not JSON');
    return null;
  }
  if (typeof envelope !== 'object' || envelope === null || !('version' in envelope) || !('state' in envelope)) {
    devWarn('[cart] discarded saved cart: not a persisted envelope');
    return null;
  }
  const version = typeof envelope.version === 'number' ? envelope.version : Number.NaN;
  const migrated = migrateCart(envelope.state, version);
  if (migrated === null) {
    devWarn(`[cart] discarded saved cart: unknown version ${String(envelope.version)}`);
    return null;
  }
  const parsed = PersistedCartSchema.safeParse(migrated);
  if (!parsed.success) {
    devWarn('[cart] discarded saved cart: invalid', parsed.error.issues);
    return null;
  }
  return parsed.data.lines;
}

/** Fixed key order, so the same cart always serialises to the same string (write-skipping relies on it). */
function serialise(lines: readonly CartLine[]): string {
  const envelope: StorageValue<PersistedCart> = {
    state: {
      lines: lines.map(({ productId, quantity, unitPriceCents, title, imageUrl }) => ({
        productId,
        quantity,
        unitPriceCents,
        title,
        imageUrl,
      })),
    },
    version: CART_VERSION,
  };
  return JSON.stringify(envelope);
}

function emptyCart(): StorageValue<PersistedCart> {
  return { state: { lines: [] }, version: CART_VERSION };
}
