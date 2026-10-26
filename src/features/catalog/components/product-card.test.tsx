import { render, screen, within } from '@testing-library/react';
import type { Cents } from '@/lib/money';
import { makeProduct } from '@/test/fixtures/products';
import { ProductCard } from './product-card';

describe('ProductCard (FR-001)', () => {
  it('shows image, title, price, category, and rating', () => {
    render(<ProductCard product={makeProduct({ priceCents: 1999 as Cents })} />);
    const card = screen.getByRole('article');

    expect(within(card).getByRole('heading', { name: 'Fjallraven - Foldsack No. 1 Backpack, Fits 15 Laptops' })).toBeInTheDocument();
    expect(within(card).getByRole('img', { name: 'Fjallraven - Foldsack No. 1 Backpack, Fits 15 Laptops' })).toBeInTheDocument();
    expect(within(card).getByText('$19.99')).toBeInTheDocument();
    expect(within(card).getByText("men's clothing")).toBeInTheDocument();
    expect(within(card).getByText('Rated 3.9 out of 5 (120 reviews)')).toBeInTheDocument();
  });

  it('renders markup in API text as literal text (FR-014)', () => {
    const { container } = render(<ProductCard product={makeProduct({ title: '<img src=x onerror=alert(1)>' })} />);

    expect(screen.getByRole('heading', { name: '<img src=x onerror=alert(1)>' })).toBeInTheDocument();
    // The only <img> is the product image, not one injected from the title.
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('loads first-row images eagerly and the rest lazily', () => {
    const { rerender } = render(<ProductCard product={makeProduct()} priority />);
    expect(screen.getByRole('img')).toHaveAttribute('loading', 'eager');

    rerender(<ProductCard product={makeProduct()} />);
    expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy');
  });
});
