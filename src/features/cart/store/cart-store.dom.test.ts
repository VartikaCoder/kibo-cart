import { subtotalCents, totalQuantity } from '@/features/cart';
import type { InventoryProvider } from '@/lib/inventory';
import type { Cents } from '@/lib/money';
import { line, snapshot } from '@/test/fixtures/cart';
import { connectCartPersistence } from './cart-persistence';
import { CART_STORAGE_KEY } from './cart-storage';
import { type CartStoreApi, createCartStore } from './cart-store';

/** Availability per product id for the test inventory; anything unlisted has plenty. */
function inventory(available: Record<number, number> = {}): InventoryProvider {
  return { getAvailable: (id) => available[id] ?? 50 };
}

const saved = (lines: unknown[], version: unknown = 1) => JSON.stringify({ state: { lines }, version });
const storedLines = () => JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? 'null')?.state.lines;
const quantities = (store: CartStoreApi) => store.getState().lines.map((l) => [l.productId, l.quantity]);

let writes: jest.SpyInstance;
let warn: jest.SpyInstance;
let disconnect: (() => void) | undefined;

/** Lets pending promise chains (rehydrate → completeHydration) finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  localStorage.clear();
  writes = jest.spyOn(Storage.prototype, 'setItem');
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  disconnect?.();
  disconnect = undefined;
  writes.mockRestore();
  warn.mockRestore();
});

async function hydratedStore(available?: Record<number, number>, onQuantityReduced?: jest.Mock) {
  const store = createCartStore({ inventory: inventory(available) });
  disconnect = connectCartPersistence(store, { onQuantityReduced });
  await settle();
  writes.mockClear();
  return store;
}

describe('actions', () => {
  it('delegate to the domain and update derived totals immediately (FR-009)', async () => {
    const store = await hydratedStore();
    const { addItem, increment } = store.getState();

    addItem(snapshot(1, 1999));
    addItem(snapshot(2, 1));
    increment(1);

    expect(quantities(store)).toEqual([[1, 2], [2, 1]]);
    expect(totalQuantity(store.getState())).toBe(3);
    expect(subtotalCents(store.getState())).toBe(3999);
  });

  it.each([
    ['availability below the policy cap', 4, { max: 4, reason: 'availability' }],
    ['the per-line policy cap', 50, { max: 10, reason: 'policy' }],
  ])('stops at %s and reports which limit applied', async (_label, available, limit) => {
    const store = await hydratedStore({ 1: available });

    const results = Array.from({ length: 12 }, () => store.getState().addItem(snapshot(1)));

    expect(quantities(store)).toEqual([[1, limit.max]]);
    expect(results.at(-1)).toEqual({
      outcome: { type: 'limit-reached', productId: 1, quantity: limit.max, maxQuantity: limit.max },
      limit,
    });
  });

  it('clears a line’s price notice when the line is removed', async () => {
    const store = await hydratedStore();
    store.getState().addItem(snapshot(1, 1000));
    store.getState().reconcile(new Map([[1, 1200 as Cents]]));

    store.getState().decrement(1);

    expect(store.getState().priceNotices).toEqual({});
  });
});

describe('persistence writes (contracts/persisted-cart.md)', () => {
  it('writes exactly once per cart change, and only the lines', async () => {
    const store = await hydratedStore();

    store.getState().addItem(snapshot(1));
    store.getState().increment(1);
    store.getState().removeLine(1);

    expect(writes).toHaveBeenCalledTimes(3);
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '')).toEqual({ state: { lines: [] }, version: 1 });
  });

  it('does not write for no-op outcomes or UI-only state', async () => {
    const store = await hydratedStore({ 1: 1 });
    store.getState().addItem(snapshot(1));
    writes.mockClear();
    const s = store.getState();

    s.increment(1); // limit-reached
    s.increment(99); // not-found
    s.setQuantity(1, 'abc'); // rejected
    s.announce('hello');
    s.setDrawerOpen(true);

    expect(writes).not.toHaveBeenCalled();
    expect(storedLines()).toEqual([line(1, 1)]);
  });

  it('keeps working in memory when storage refuses writes (quota, private mode)', async () => {
    const store = await hydratedStore();
    writes.mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    store.getState().addItem(snapshot(1));

    expect(quantities(store)).toEqual([[1, 1]]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not save cart'), expect.any(DOMException));
  });
});

describe('hydration (FR-011, US3-AS4)', () => {
  it('starts empty and not hydrated, so server and first client render match', () => {
    localStorage.setItem(CART_STORAGE_KEY, saved([line(1, 2)]));
    const store = createCartStore({ inventory: inventory() });

    expect(store.getState()).toMatchObject({ lines: [], hydrated: false });
  });

  it('restores the saved cart after connecting, without writing it back', async () => {
    localStorage.setItem(CART_STORAGE_KEY, saved([line(1, 2), line(2, 1)]));
    writes.mockClear();

    const store = await hydratedStore();

    expect(store.getState().hydrated).toBe(true);
    expect(quantities(store)).toEqual([[1, 2], [2, 1]]);
    expect(writes).not.toHaveBeenCalled();
  });

  it('lowers saved quantities above the current limit, saves that, and reports it once for announcing', async () => {
    localStorage.setItem(CART_STORAGE_KEY, saved([line(1, 8), line(2, 2)]));
    const onQuantityReduced = jest.fn();

    const store = await hydratedStore({ 1: 4 }, onQuantityReduced);

    expect(quantities(store)).toEqual([[1, 4], [2, 2]]);
    expect(storedLines()).toEqual([line(1, 4), line(2, 2)]);
    expect(onQuantityReduced).toHaveBeenCalledTimes(1);
    expect(onQuantityReduced).toHaveBeenCalledWith([
      { productId: 1, title: 'Product 1', from: 8, to: 4, reason: 'availability' },
    ]);
    expect(store.getState().quantityNotices).toEqual({ 1: { from: 8, to: 4, reason: 'availability' } });
  });

  it('does not report anything when no saved quantity was lowered', async () => {
    localStorage.setItem(CART_STORAGE_KEY, saved([line(1, 2)]));
    const onQuantityReduced = jest.fn();

    const store = await hydratedStore({ 1: 4 }, onQuantityReduced);

    expect(onQuantityReduced).not.toHaveBeenCalled();
    expect(store.getState().quantityNotices).toEqual({});
  });

  it.each([
    ['dismissed', (s: ReturnType<CartStoreApi['getState']>) => s.dismissQuantityNotice(1)],
    ['made stale by changing that line', (s: ReturnType<CartStoreApi['getState']>) => s.decrement(1)],
  ])('removes the reduced-quantity notice when %s, leaving other lines’ notices', async (_label, act) => {
    localStorage.setItem(CART_STORAGE_KEY, saved([line(1, 8), line(2, 9)]));
    const store = await hydratedStore({ 1: 4, 2: 5 });

    act(store.getState());

    expect(store.getState().quantityNotices).toEqual({ 2: { from: 9, to: 5, reason: 'availability' } });
  });

  it('reports nothing if disconnected before loading finished (e.g. React Strict Mode remount)', async () => {
    localStorage.setItem(CART_STORAGE_KEY, saved([line(1, 8)]));
    const onQuantityReduced = jest.fn();
    const store = createCartStore({ inventory: inventory({ 1: 4 }) });

    connectCartPersistence(store, { onQuantityReduced })();
    await settle();

    expect(onQuantityReduced).not.toHaveBeenCalled();
  });

  it.each([
    ['not JSON', '{oops'],
    ['an unknown version', saved([line(1, 1)], 2)],
    ['duplicate productIds', saved([line(1, 1), line(1, 2)])],
    ['an invalid line', saved([line(1, 1), { ...line(2, 1), quantity: 0 }])],
  ])('discards a saved cart with %s: starts empty, removes the key, warns in dev', async (_label, raw) => {
    localStorage.setItem(CART_STORAGE_KEY, raw);

    const store = await hydratedStore();

    expect(store.getState()).toMatchObject({ lines: [], hydrated: true });
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
    expect(warn.mock.calls.map(([message]) => message)).toContainEqual(expect.stringContaining('discarded saved cart'));
  });

  it('starts empty when storage can’t be read at all', async () => {
    const reads = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    const store = await hydratedStore();
    reads.mockRestore();

    expect(store.getState()).toMatchObject({ lines: [], hydrated: true });
  });
});

describe('cross-tab sync (FR-011, US3-AS2)', () => {
  /** What another tab does: change storage, then the browser fires `storage` in this tab. */
  function otherTab(key: string | null, newValue: string | null) {
    if (key !== null) {
      if (newValue === null) localStorage.removeItem(key);
      else localStorage.setItem(key, newValue);
    } else {
      localStorage.clear();
    }
    window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea: localStorage }));
  }

  it('replaces this tab’s cart with the other tab’s (last write wins), without writing back', async () => {
    const store = await hydratedStore();
    store.getState().addItem(snapshot(1));

    otherTab(CART_STORAGE_KEY, saved([line(2, 3)]));
    writes.mockClear();
    await settle();

    expect(quantities(store)).toEqual([[2, 3]]);
    expect(writes).not.toHaveBeenCalled();
  });

  it.each([
    ['removed the cart key', CART_STORAGE_KEY, null],
    ['cleared all storage', null, null],
    ['saved an invalid cart', CART_STORAGE_KEY, saved([line(1, 1), line(1, 1)])],
  ])('empties this tab’s cart when another tab %s', async (_label, key, value) => {
    const store = await hydratedStore();
    store.getState().addItem(snapshot(1));

    otherTab(key, value);
    await settle();

    expect(store.getState().lines).toEqual([]);
  });

  it('ignores storage events for other keys, and stops listening after disconnect', async () => {
    const store = await hydratedStore();
    store.getState().addItem(snapshot(1));

    otherTab('something-else', 'x');
    disconnect?.();
    disconnect = undefined;
    localStorage.setItem(CART_STORAGE_KEY, saved([]));
    window.dispatchEvent(new StorageEvent('storage', { key: CART_STORAGE_KEY, storageArea: localStorage }));
    await settle();

    expect(quantities(store)).toEqual([[1, 1]]);
  });
});

describe('reconcile and announcements', () => {
  it('updates prices, records notices and unavailable lines, and excludes those from totals (FR-018)', async () => {
    const store = await hydratedStore();
    store.getState().addItem(snapshot(1, 1000));
    store.getState().addItem(snapshot(2, 500));

    const { priceChanges } = store.getState().reconcile(new Map([[1, 1200 as Cents]]));
    const state = store.getState();

    expect(priceChanges).toEqual([{ productId: 1, fromCents: 1000, toCents: 1200 }]);
    expect(state.priceNotices).toEqual({ 1: { fromCents: 1000, toCents: 1200 } });
    expect(state.unavailableIds).toEqual([2]);
    expect(subtotalCents(state, state.unavailableIds)).toBe(1200);

    state.dismissPriceNotice(1);
    expect(store.getState().priceNotices).toEqual({});
  });

  it('gives each announcement a new id, so a repeated message is announced again', async () => {
    const store = await hydratedStore();
    store.getState().announce('Added');
    const first = store.getState().announcement;
    store.getState().announce('Added');

    expect(store.getState().announcement).toEqual({ id: (first?.id ?? 0) + 1, message: 'Added' });
  });
});
