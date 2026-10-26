import { fireEvent, render, screen, within } from '@testing-library/react';
import { cartState, seedCart, setCart } from '@/test/cart-store';
import { line } from '@/test/fixtures/cart';
import { CartAnnouncer } from './cart-announcer';
import { CartButton } from './cart-button';
import { CartDrawer } from './cart-drawer';

function renderCart() {
  render(
    <>
      <CartButton />
      <CartDrawer />
      <CartAnnouncer />
    </>,
  );
}

function openCart() {
  fireEvent.click(screen.getByRole('button', { name: /^Cart/ }));
  return screen.getByRole('dialog', { name: 'Your cart' });
}

const removeButton = (id: number) => screen.getByRole('button', { name: `Remove Product ${id} from cart` });

describe('CartButton', () => {
  it('shows no count until the saved cart has loaded, then the item count', () => {
    seedCart([line(1, 2), line(2, 1)], { hydrated: false });
    renderCart();
    expect(screen.getByRole('button', { name: 'Cart' })).toHaveAttribute('aria-expanded', 'false');

    setCart({ hydrated: true });

    expect(screen.getByRole('button', { name: 'Cart, 3 items' })).toHaveAttribute('aria-haspopup', 'dialog');
  });
});

describe('CartDrawer', () => {
  it('lists lines with line totals and the derived subtotal (FR-009)', () => {
    seedCart([line(1, 2, 1999), line(2, 1, 500)]);
    renderCart();
    const dialog = openCart();

    expect(screen.getByRole('button', { name: 'Cart, 3 items' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(2);
    expect(within(dialog).getByText('$39.98')).toBeInTheDocument();
    expect(within(dialog).getByText('Subtotal').nextElementSibling).toHaveTextContent('$44.98');
  });

  it('updates a line through its stepper and announces the new subtotal', () => {
    seedCart([line(2, 1, 500)]);
    renderCart();
    openCart();

    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity of Product 2' }));

    expect(cartState().lines[0].quantity).toBe(2);
    expect(screen.getByRole('status')).toHaveTextContent('Product 2 quantity 2. Subtotal $10.00.');
  });

  it.each([
    ['the next line', 2, 3],
    ['the previous line when it was last', 3, 2],
  ])('after removing a line, focuses %s’s Remove button', (_label, removed, focused) => {
    // Quantity 2, so "−" is "Decrease…" and the line's Remove button is the only "Remove …" control.
    seedCart([line(1, 2), line(2, 2), line(3, 2)]);
    renderCart();
    openCart();

    fireEvent.click(removeButton(removed));

    expect(screen.getByRole('status')).toHaveTextContent(`Product ${removed} removed from cart.`);
    expect(removeButton(focused)).toHaveFocus();
  });

  it('after removing the only line, shows the empty state and focuses it', () => {
    seedCart([line(1, 2)]);
    renderCart();
    openCart();

    fireEvent.click(removeButton(1));

    expect(screen.getByText('Your cart is empty.').parentElement).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Cart, 0 items' })).toBeInTheDocument();
  });

  it('shows a reduced-quantity note on its line, which can be dismissed', () => {
    seedCart([line(4, 5)], { quantityNotices: { 4: { from: 8, to: 5, reason: 'availability' } } });
    renderCart();
    openCart();

    expect(screen.getByText('Reduced to 5 — only 5 available (demo inventory)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss note for Product 4' }));

    expect(screen.queryByText(/Reduced to 5/)).not.toBeInTheDocument();
  });

  it('"Continue shopping" on the empty cart closes it and returns focus to the cart button', () => {
    seedCart();
    renderCart();
    const cartButton = screen.getByRole('button', { name: 'Cart, 0 items' });
    cartButton.focus();
    openCart();

    fireEvent.click(screen.getByRole('button', { name: 'Continue shopping' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cartButton).toHaveFocus();
    expect(cartButton).toHaveAttribute('aria-expanded', 'false');
  });
});

