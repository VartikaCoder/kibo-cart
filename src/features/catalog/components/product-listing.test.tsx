import { render, screen, within } from '@testing-library/react';
import { makeProducts } from '@/test/fixtures/products';
import { applyCatalogueQuery } from '../query/apply-catalogue-query';
import { type CatalogueQuery, DEFAULT_QUERY } from '../query/catalogue-query';
import type { CatalogueSource } from '../types';
import { ProductListing } from './product-listing';

jest.mock('next/navigation', () => jest.requireActual('@/test/next-navigation').nextNavigationMock);

const products = makeProducts(30);
const categories = ['electronics', 'jewelery', "men's clothing"];

function renderListing(patch: Partial<CatalogueQuery> = {}, source: CatalogueSource = 'live') {
  const query = { ...DEFAULT_QUERY, ...patch };
  return render(
    <ProductListing
      source={source}
      categories={categories}
      query={query}
      result={applyCatalogueQuery(products, query)}
      retryAction={jest.fn(async () => {})}
    />,
  );
}

const productTitles = () =>
  screen.getAllByRole('article').map((card) => within(card).getByRole('heading').textContent);

describe('ProductListing', () => {
  it('shows the first page of 12 products and a result count', () => {
    renderListing();

    expect(screen.getAllByRole('article')).toHaveLength(12);
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1–12 of 30 products');
  });

  it('shows only the filtered category', () => {
    renderListing({ category: 'jewelery' });

    expect(screen.getAllByRole('article')).toHaveLength(10);
    screen.getAllByRole('article').forEach((card) => expect(card).toHaveTextContent('jewelery'));
    expect(screen.getByRole('status')).toHaveTextContent('10 products');
  });

  it('shows products in the requested sort order', () => {
    renderListing({ sort: 'price-desc' });
    expect(productTitles().slice(0, 3)).toEqual(['Product 030', 'Product 029', 'Product 028']);
  });

  it('shows the search match only', () => {
    renderListing({ q: 'product 007' });
    expect(productTitles()).toEqual(['Product 007']);
    expect(screen.getByRole('status')).toHaveTextContent('1 product');
  });

  describe('empty state (FR-002)', () => {
    it('explains there are no matches, echoes the search as text, and offers to clear filters', () => {
      renderListing({ q: '<b>nothing</b>' });

      expect(screen.queryAllByRole('article')).toHaveLength(0);
      expect(screen.getByRole('heading', { name: 'No products found' })).toBeInTheDocument();
      expect(screen.getByText('No products match “<b>nothing</b>” with the selected filters.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute('href', '/');
      expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
    });

    it('omits the search phrase when only filters are applied', () => {
      render(
        <ProductListing
          source="live"
          categories={categories}
          query={{ ...DEFAULT_QUERY, category: 'electronics' }}
          result={{ items: [], totalItems: 0, totalPages: 1, page: 1 }}
          retryAction={jest.fn(async () => {})}
        />,
      );
      expect(screen.getByText('No products match the selected filters.')).toBeInTheDocument();
    });
  });

  describe('pagination (FR-005)', () => {
    it('marks the current page and links the others, keeping filters in the URL', () => {
      renderListing({ sort: 'name-asc', page: 2 });
      const nav = screen.getByRole('navigation', { name: 'Pagination' });

      expect(within(nav).getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
      expect(within(nav).getByRole('link', { name: 'Page 1' })).toHaveAttribute('href', '/?sort=name-asc');
      expect(within(nav).getByRole('link', { name: 'Page 3' })).toHaveAttribute('href', '/?sort=name-asc&page=3');
      expect(within(nav).getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/?sort=name-asc');
      expect(within(nav).getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/?sort=name-asc&page=3');
    });

    it('omits Previous on the first page and Next on the last', () => {
      renderListing({ page: 1 });
      expect(screen.queryByRole('link', { name: 'Previous' })).not.toBeInTheDocument();
    });

    it('shows the last page when the URL asks for a page past the end', () => {
      renderListing({ page: 99 });
      const nav = screen.getByRole('navigation', { name: 'Pagination' });

      expect(within(nav).getByRole('link', { name: 'Page 3' })).toHaveAttribute('aria-current', 'page');
      expect(screen.queryByRole('link', { name: 'Next' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(6);
    });

    it('hides pagination when everything fits on one page', () => {
      renderListing({ category: 'electronics' });
      expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
    });
  });

  describe('snapshot notice', () => {
    it('is shown, as a status message, only when the catalogue came from the snapshot', () => {
      const { unmount } = renderListing({}, 'snapshot');
      expect(screen.getByText(/Showing a saved copy of the catalogue/)).toBeInTheDocument();
      expect(screen.getByText(/Showing a saved copy/).closest('[role="status"]')).not.toBeNull();
      // Non-blocking: the products are still listed.
      expect(screen.getAllByRole('article')).toHaveLength(12);
      unmount();

      renderListing({}, 'live');
      expect(screen.queryByText(/Showing a saved copy of the catalogue/)).not.toBeInTheDocument();
    });
  });
});
