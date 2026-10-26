import { fireEvent, render, screen } from '@testing-library/react';
import { CatalogueError } from './catalogue-error';
import { CatalogueLoading } from './catalogue-loading';

describe('loading state (FR-002)', () => {
  it('announces loading and renders a placeholder per product slot', () => {
    const { container } = render(<CatalogueLoading />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading products…');
    expect(status).toHaveAttribute('aria-busy', 'true');
    // Placeholders are invisible to assistive tech; only the status text is announced.
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(container.querySelectorAll('[aria-hidden="true"] .animate-pulse').length).toBeGreaterThanOrEqual(12);
  });
});

describe('error state (FR-002)', () => {
  it('explains the failure as an alert without exposing error details', () => {
    render(<CatalogueError onRetry={jest.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load the products');
    expect(screen.getByRole('alert')).toHaveTextContent('The store is temporarily unavailable.');
  });

  it('retries when the shopper asks', () => {
    const onRetry = jest.fn();
    render(<CatalogueError onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
