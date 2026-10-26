import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type InventoryProvider, simulatedInventory } from '@/lib/inventory';
import type { Cents } from '@/lib/money';
import { getLineLimit, type LineLimit } from '@/lib/stock';
import * as domain from '../domain/cart';
import { CART_VERSION } from '../domain/migrate';
import { type Reconciliation, reconcileWithCatalogue } from '../domain/reconcile';
import type { CartLine, CartOutcome, CartResult, ProductSnapshot } from '../domain/types';
import { CART_STORAGE_KEY, createCartStorage } from './cart-storage';

export interface PriceNotice {
  fromCents: Cents;
  toCents: Cents;
}

/** A saved quantity was lowered on load because the line limit is now lower. */
export interface QuantityNotice {
  from: number;
  to: number;
  reason: LineLimit['reason'];
}

export interface QuantityReduction extends QuantityNotice {
  productId: number;
  title: string;
}

export interface Announcement {
  /** Changes on every announcement, so repeating the same message is still announced. */
  id: number;
  message: string;
}

export interface CartState {
  /** Persisted. Everything else is per-page UI state (data-model §8). */
  lines: readonly CartLine[];
  /** False until the saved cart has been read and checked; until then, render placeholders, not 0 (US3-AS4). */
  hydrated: boolean;
  announcement: Announcement | null;
  priceNotices: Readonly<Record<number, PriceNotice>>;
  /** Shown on the line until dismissed or until the shopper changes that line. */
  quantityNotices: Readonly<Record<number, QuantityNotice>>;
  /** Products missing from the last live catalogue. Excluded from totals; removable only. */
  unavailableIds: readonly number[];
  drawerOpen: boolean;
}

/** Outcome of an action whose result depends on the line limit, with the limit that applied. */
export interface LimitedOutcome {
  outcome: CartOutcome;
  limit: LineLimit;
}

export interface CartActions {
  addItem(product: ProductSnapshot): LimitedOutcome;
  increment(productId: number): LimitedOutcome;
  setQuantity(productId: number, raw: string | number): LimitedOutcome;
  decrement(productId: number): CartOutcome;
  removeLine(productId: number): CartOutcome;
  /** Call only with a live catalogue's prices; a snapshot isn't authoritative (research R3). */
  reconcile(prices: ReadonlyMap<number, Cents>): Reconciliation;
  /**
   * Runs after the saved cart is read: lowers quantities above the current line limit, records a notice
   * per lowered line, marks the cart hydrated, and returns what was lowered (for the announcement).
   */
  completeHydration(): QuantityReduction[];
  /** The current limit for a line (policy or simulated availability), for display. */
  lineLimit(productId: number): LineLimit;
  dismissPriceNotice(productId: number): void;
  dismissQuantityNotice(productId: number): void;
  announce(message: string): void;
  setDrawerOpen(open: boolean): void;
}

export type CartStore = CartState & CartActions;

interface CartStoreOptions {
  inventory?: InventoryProvider;
  storage?: Parameters<typeof createCartStorage>[0];
}

const browserLocalStorage = () => (typeof window === 'undefined' ? undefined : window.localStorage);

/**
 * A thin adapter: actions look up the line limit, call a pure domain function, and store the result.
 * Business rules live in `cart/domain`. Actions read the latest state with `get()` at call time
 * (zustand updates synchronously), so rapid repeated actions each apply to the result of the previous one.
 */
export function createCartStore({ inventory = simulatedInventory, storage = browserLocalStorage }: CartStoreOptions = {}) {
  const limitFor = (productId: number) => getLineLimit(productId, inventory);

  return create<CartStore>()(
    persist(
      (set, get) => {
        /**
         * Stores a domain result. No-op outcomes don't call `set`, so they cause no re-render and no write.
         * Any change to a line makes its "reduced on load" notice stale; removal also drops its price notice.
         */
        function commit({ cart, outcome }: CartResult): CartOutcome {
          if (cart === get()) return outcome;
          const { productId } = outcome;
          set((state) => ({
            lines: cart.lines,
            quantityNotices: without(state.quantityNotices, productId),
            ...(outcome.type === 'removed' && { priceNotices: without(state.priceNotices, productId) }),
          }));
          return outcome;
        }

        function limited(productId: number, run: (max: number) => CartResult): LimitedOutcome {
          const limit = limitFor(productId);
          return { outcome: commit(run(limit.max)), limit };
        }

        return {
          lines: [],
          hydrated: false,
          announcement: null,
          priceNotices: {},
          quantityNotices: {},
          unavailableIds: [],
          drawerOpen: false,

          addItem: (product) => limited(product.productId, (max) => domain.addItem(get(), product, max)),
          increment: (productId) => limited(productId, (max) => domain.increment(get(), productId, max)),
          setQuantity: (productId, raw) => limited(productId, (max) => domain.setQuantity(get(), productId, raw, max)),
          decrement: (productId) => commit(domain.decrement(get(), productId)),
          removeLine: (productId) => commit(domain.removeLine(get(), productId)),

          reconcile: (prices) => {
            const result = reconcileWithCatalogue(get(), prices);
            set((state) => ({
              lines: result.cart.lines,
              unavailableIds: result.missingIds,
              priceNotices: {
                ...state.priceNotices,
                ...Object.fromEntries(
                  result.priceChanges.map((c) => [c.productId, { fromCents: c.fromCents, toCents: c.toCents }]),
                ),
              },
            }));
            return result;
          },

          completeHydration: () => {
            const state = get();
            const { cart, adjustments } = domain.clampToLimits(state, (productId) => limitFor(productId).max);
            const reductions = adjustments.map(({ productId, from, to }) => ({
              productId,
              from,
              to,
              reason: limitFor(productId).reason,
              title: cart.lines.find((l) => l.productId === productId)?.title ?? '',
            }));
            set({
              hydrated: true,
              ...(reductions.length > 0 && {
                lines: cart.lines,
                quantityNotices: {
                  ...state.quantityNotices,
                  ...Object.fromEntries(reductions.map(({ productId, from, to, reason }) => [productId, { from, to, reason }])),
                },
              }),
            });
            return reductions;
          },

          lineLimit: limitFor,
          dismissPriceNotice: (productId) => set((state) => ({ priceNotices: without(state.priceNotices, productId) })),
          dismissQuantityNotice: (productId) =>
            set((state) => ({ quantityNotices: without(state.quantityNotices, productId) })),
          announce: (message) => set((state) => ({ announcement: { id: (state.announcement?.id ?? 0) + 1, message } })),
          setDrawerOpen: (open) => set({ drawerOpen: open }),
        };
      },
      {
        name: CART_STORAGE_KEY,
        version: CART_VERSION,
        storage: createCartStorage(storage),
        partialize: (state) => ({ lines: [...state.lines] }),
        // Read the saved cart only on the client, after the first render, so server and client markup match.
        // `connectCartPersistence` rehydrates and then calls `completeHydration`.
        skipHydration: true,
      },
    ),
  );
}

export type CartStoreApi = ReturnType<typeof createCartStore>;

/** The app's cart. Components subscribe with narrow selectors: `useCartStore((s) => totalQuantity(s))`. */
export const useCartStore = createCartStore();

function without<T>(record: Readonly<Record<number, T>>, key: number): Record<number, T> {
  if (!(key in record)) return record;
  return Object.fromEntries(Object.entries(record).filter(([id]) => Number(id) !== key));
}
