/*
 * Evidence for review/CODE_REVIEW.md: the refactor preserves behaviour. Drives both cards through the same
 * interactions and compares what a user sees, plus the `onAdd` calls. Lives beside the review files; the app
 * imports none of them.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { type Product, ProductCard as Before } from './product-card.bad';
import { ProductCard as After } from './product-card.good';

const product = (id: number, title: string, price: number): Product => ({
  id,
  title,
  price,
  description: '',
  category: '',
  image: '',
  rating: { rate: 0, count: 0 },
});
const MUG = product(1, 'Mug', 19.99);
const LAMP = product(2, 'Lamp', 0.1);
const cents = { 1: 1999, 2: 10 } as const; // the same prices, converted at the boundary as the app does

/** What a user can observe on the card right now. */
function observe() {
  const decrease = screen.getByRole('button', { name: /^Decrease/ }) as HTMLButtonElement;
  return {
    title: screen.getByRole('heading').textContent,
    unit: screen.getByText(/each$/).textContent,
    total: screen.getByText(/^Total/).textContent,
    decreaseDisabled: decrease.disabled,
  };
}

/** +, +, −, then Add: the same script for both versions. */
function drive() {
  const seen = [observe()];
  fireEvent.click(screen.getByRole('button', { name: /^Increase/ }));
  fireEvent.click(screen.getByRole('button', { name: /^Increase/ }));
  seen.push(observe());
  fireEvent.click(screen.getByRole('button', { name: /^Decrease/ }));
  seen.push(observe());
  fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
  return seen;
}

describe('ProductCard refactor (review exercise)', () => {
  it('shows the same text, totals, and disabled states, and reports the same add', () => {
    const beforeAdd = jest.fn();
    const before = render(<Before product={MUG} onAdd={beforeAdd} />);
    const beforeSeen = drive();
    before.unmount();

    const afterAdd = jest.fn();
    render(<After key={MUG.id} productId={MUG.id} title={MUG.title} unitPriceCents={cents[1]} onAdd={afterAdd} />);
    const afterSeen = drive();

    expect(afterSeen).toEqual(beforeSeen);
    expect(afterSeen.map((s) => s.total)).toEqual(['Total: $19.99', 'Total: $59.97', 'Total: $39.98']);
    // Same add, narrower arguments: the id instead of the whole product.
    expect(afterAdd.mock.calls).toEqual(beforeAdd.mock.calls.map(([p, quantity]) => [p.id, quantity]));
    expect(afterAdd).toHaveBeenCalledWith(1, 2);
  });

  it('starts again from quantity 1 when the card shows a different product (effect before, key after)', () => {
    const before = render(<Before product={MUG} onAdd={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Increase/ }));
    before.rerender(<Before product={LAMP} onAdd={jest.fn()} />);
    const beforeSwitched = observe();
    before.unmount();

    const after = render(<After key={MUG.id} productId={1} title="Mug" unitPriceCents={cents[1]} onAdd={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Increase/ }));
    after.rerender(<After key={LAMP.id} productId={2} title="Lamp" unitPriceCents={cents[2]} onAdd={jest.fn()} />);

    expect(observe()).toEqual(beforeSwitched);
    expect(observe().total).toBe('Total: $0.10');
  });
});
