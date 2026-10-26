import { act } from '@testing-library/react';
import type { CartLine } from '@/features/cart';
import { useCartStore } from '@/features/cart/store/cart-store';

const initialState = useCartStore.getState();

/**
 * Resets the app's real cart store to a known, hydrated state. Component tests use the real store and the
 * simulated inventory (product 1: policy cap 10; product 4: 5 available), as the app does.
 */
export function seedCart(lines: CartLine[] = [], patch: Partial<ReturnType<typeof useCartStore.getState>> = {}) {
  localStorage.clear();
  act(() => useCartStore.setState({ ...initialState, hydrated: true, lines, ...patch }, true));
}

export const cartState = () => useCartStore.getState();

/** Changes the store as the app would (e.g. hydration finishing), inside act(). */
export function setCart(patch: Partial<ReturnType<typeof useCartStore.getState>>) {
  act(() => useCartStore.setState(patch));
}
