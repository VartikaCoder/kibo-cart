import { act, render, screen } from '@testing-library/react';
import { simulatedInventory } from '@/lib/inventory';
import { line } from '@/test/fixtures/cart';
import { CART_STORAGE_KEY } from '../store/cart-storage';
import { useCartStore } from '../store/cart-store';
import { CartAnnouncer } from './cart-announcer';
import { CartHydrator } from './cart-hydrator';

// Uses the app's real store and simulated inventory, as the layout does.
const initialState = useCartStore.getState();
const LIMITED_ID = Array.from({ length: 50 }, (_, i) => i + 1).find((id) => simulatedInventory.getAvailable(id) < 8)!; // the simulated range (3–20) guarantees one
const limit = simulatedInventory.getAvailable(LIMITED_ID);

beforeEach(() => {
  localStorage.clear();
  useCartStore.setState(initialState, true);
});

function renderShell() {
  return render(
    <>
      <CartHydrator />
      <CartAnnouncer />
    </>,
  );
}

describe('CartHydrator + CartAnnouncer', () => {
  it('provides one polite status region, empty until there is something to say', () => {
    renderShell();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('announces on load when a saved quantity had to be reduced', async () => {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ state: { lines: [{ ...line(LIMITED_ID, 8), title: 'Backpack' }] }, version: 1 }),
    );

    renderShell();
    await act(async () => {});

    expect(screen.getByRole('status')).toHaveTextContent(`Backpack reduced from 8 to ${limit} — only ${limit} available (demo inventory).`);
    expect(useCartStore.getState().lines[0].quantity).toBe(limit);
  });

  it('stays silent on load when nothing was reduced', async () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ state: { lines: [line(LIMITED_ID, 1)] }, version: 1 }));

    renderShell();
    await act(async () => {});

    expect(useCartStore.getState().hydrated).toBe(true);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('re-announces an identical message', () => {
    renderShell();

    act(() => useCartStore.getState().announce('Backpack added to cart.'));
    const first = screen.getByText('Backpack added to cart.');
    act(() => useCartStore.getState().announce('Backpack added to cart.'));

    expect(screen.getByText('Backpack added to cart.')).not.toBe(first); // a new node, so it's read again
  });
});
