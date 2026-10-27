import { fireEvent, render, screen } from '@testing-library/react';
import { cartState, seedCart } from '@/test/cart-store';
import { line, snapshot } from '@/test/fixtures/cart';
import { CartAnnouncer } from './cart-announcer';
import { AddToCartControl } from './add-to-cart-control';

// Simulated inventory: product 1 is capped by policy (10), product 4 by availability (5).
function renderControl(productId: number) {
  return render(
    <>
      <AddToCartControl product={snapshot(productId, 1999)} />
      <CartAnnouncer />
    </>,
  );
}

const status = () => screen.getByRole('status');

describe('AddToCartControl (US2)', () => {
  it('keeps the accessible name "Add {title} to cart" with the label wrapped for layout', () => {
    seedCart();
    renderControl(1);

    // Visible spacing needs real layout, which jsdom doesn't have; this guards the name the label wrap must not change.
    expect(screen.getByRole('button', { name: /^Add/ })).toHaveAccessibleName('Add Product 1 to cart');
  });

  it('adds the product, announces it, and swaps to a stepper with focus on "+"', () => {
    seedCart();
    renderControl(1);

    fireEvent.click(screen.getByRole('button', { name: 'Add Product 1 to cart' }));

    expect(cartState().lines).toEqual([line(1, 1, 1999)]);
    expect(status()).toHaveTextContent('Product 1 added to cart. Cart has 1 item.');
    expect(screen.getByRole('button', { name: 'Increase quantity of Product 1' })).toHaveFocus();
  });

  it('at quantity 1, "−" is a remove: it removes the line and returns focus to "Add"', () => {
    seedCart([line(1, 1)]);
    renderControl(1);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Product 1 from cart' }));

    expect(cartState().lines).toEqual([]);
    expect(status()).toHaveTextContent('Product 1 removed from cart.');
    expect(screen.getByRole('button', { name: 'Add Product 1 to cart' })).toHaveFocus();
  });

  it.each([
    ['the policy cap', 1, 10, 'Limit 10 per order', 'Limit of 10 per order reached for Product 1.'],
    [
      'simulated availability',
      4,
      5,
      'Only 5 available (demo inventory)',
      'Only 5 of Product 4 available (demo inventory).',
    ],
  ])('at %s, "+" is aria-disabled with the reason, and a click announces it', (_label, id, max, reason, announcement) => {
    seedCart([line(id, max)]);
    renderControl(id);
    const increase = screen.getByRole('button', { name: `Increase quantity of Product ${id}` });

    expect(increase).toHaveAttribute('aria-disabled', 'true');
    expect(increase).toHaveAccessibleDescription(reason);

    fireEvent.click(increase);
    expect(cartState().lines[0].quantity).toBe(max);
    expect(status()).toHaveTextContent(announcement);
  });

  it('is inert until the saved cart has loaded, so an early click can’t be overwritten', () => {
    seedCart([], { hydrated: false });
    renderControl(1);
    const add = screen.getByRole('button', { name: 'Add Product 1 to cart' });

    fireEvent.click(add);

    expect(add).toHaveAttribute('aria-disabled', 'true');
    expect(cartState().lines).toEqual([]);
  });
});
