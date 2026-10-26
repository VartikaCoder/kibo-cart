import { act, fireEvent, render, screen } from '@testing-library/react';
import { router } from '@/test/next-navigation';
import { type CatalogueQuery, DEFAULT_QUERY } from '../schemas/catalogue-query';
import { CatalogueFilters, SEARCH_DEBOUNCE_MS } from './catalogue-filters';

jest.mock('next/navigation', () => jest.requireActual('@/test/next-navigation').nextNavigationMock);

const categories = ['electronics', 'jewelery', "men's clothing"];
const noScroll = { scroll: false };

function renderFilters(patch: Partial<CatalogueQuery> = {}) {
  const view = render(<CatalogueFilters query={{ ...DEFAULT_QUERY, ...patch }} categories={categories} />);
  return {
    ...view,
    search: () => screen.getByRole('searchbox', { name: 'Search products' }),
    category: () => screen.getByRole('combobox', { name: 'Category' }),
    sort: () => screen.getByRole('combobox', { name: 'Sort by' }),
    // Simulates the server re-rendering with a new URL (e.g. after Back).
    navigateTo: (next: Partial<CatalogueQuery>) =>
      view.rerender(<CatalogueFilters query={{ ...DEFAULT_QUERY, ...next }} categories={categories} />),
  };
}

const type = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('CatalogueFilters — search (debounced, replace)', () => {
  it('lives in a search landmark with labelled controls', () => {
    renderFilters();
    expect(screen.getByRole('search')).toBeInTheDocument();
  });

  it(`waits ${SEARCH_DEBOUNCE_MS} ms after the last keystroke, then replaces the URL once`, () => {
    const { search } = renderFilters();

    type(search(), 'b');
    act(() => jest.advanceTimersByTime(200));
    type(search(), 'ba');
    act(() => jest.advanceTimersByTime(200));
    type(search(), 'bag');
    act(() => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    expect(router.replace).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(1));
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/?q=bag', noScroll);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('keeps category and sort, resets the page, and encodes special characters', () => {
    const { search } = renderFilters({ category: 'jewelery', sort: 'price-asc', page: 3 });

    type(search(), '50% & <b>');
    act(() => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS));

    expect(router.replace).toHaveBeenCalledWith('/?category=jewelery&q=50%25+%26+%3Cb%3E&sort=price-asc', noScroll);
  });

  it('does not navigate when the trimmed search is unchanged', () => {
    const { search } = renderFilters({ q: 'bag' });

    type(search(), 'bag   ');
    act(() => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS));

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('clears the search param when the box is emptied', () => {
    const { search } = renderFilters({ q: 'bag' });

    type(search(), '');
    act(() => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS));

    expect(router.replace).toHaveBeenCalledWith('/', noScroll);
  });

  it('navigates immediately on Enter and cancels the pending debounce', () => {
    const { search } = renderFilters();

    type(search(), 'ring');
    fireEvent.submit(search());
    act(() => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS));

    expect(router.push).toHaveBeenCalledWith('/?q=ring', noScroll);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('cancels a pending search on unmount', () => {
    const { search, unmount } = renderFilters();

    type(search(), 'ring');
    unmount();
    act(() => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS));

    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('CatalogueFilters — category and sort (immediate, push)', () => {
  it('lists every category plus "All categories"', () => {
    const { category } = renderFilters();
    expect(Array.from((category() as HTMLSelectElement).options).map((o) => o.text)).toEqual([
      'All categories',
      ...categories,
    ]);
  });

  it('pushes the chosen category and resets the page', () => {
    const { category } = renderFilters({ page: 2 });

    fireEvent.change(category(), { target: { value: "men's clothing" } });

    expect(router.push).toHaveBeenCalledWith("/?category=men%27s+clothing", noScroll);
  });

  it('pushes "All categories" as no category param', () => {
    const { category } = renderFilters({ category: 'electronics', sort: 'name-asc' });

    fireEvent.change(category(), { target: { value: '' } });

    expect(router.push).toHaveBeenCalledWith('/?sort=name-asc', noScroll);
  });

  it.each([
    ['price-asc', '/?sort=price-asc'],
    ['price-desc', '/?sort=price-desc'],
    ['rating-asc', '/?sort=rating-asc'],
    ['rating-desc', '/?sort=rating-desc'],
    ['name-asc', '/?sort=name-asc'],
    ['name-desc', '/?sort=name-desc'],
    ['featured', '/'],
  ])('pushes sort %s', (value, href) => {
    const { sort } = renderFilters(value === 'featured' ? { sort: 'price-asc' } : {});

    fireEvent.change(sort(), { target: { value } });

    expect(router.push).toHaveBeenCalledWith(href, noScroll);
  });

  it('includes text still being typed, and drops the stale debounced search', () => {
    const { search, category } = renderFilters();

    type(search(), 'gold');
    fireEvent.change(category(), { target: { value: 'jewelery' } });
    act(() => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS));

    expect(router.push).toHaveBeenCalledWith('/?category=jewelery&q=gold', noScroll);
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('CatalogueFilters — following the URL', () => {
  it('shows the values from the URL', () => {
    const { search, category, sort } = renderFilters({ q: 'ring', category: 'jewelery', sort: 'rating-desc' });

    expect(search()).toHaveValue('ring');
    expect(category()).toHaveValue('jewelery');
    expect(sort()).toHaveValue('rating-desc');
  });

  it('updates the controls when the URL changes (e.g. Back)', () => {
    const { search, category, sort, navigateTo } = renderFilters({ q: 'ring', category: 'jewelery' });

    navigateTo({ q: 'bag', sort: 'name-desc' });

    expect(search()).toHaveValue('bag');
    expect(category()).toHaveValue('');
    expect(sort()).toHaveValue('name-desc');
  });

  it('keeps what the user is typing when the URL catches up with the trimmed value', () => {
    const { search, navigateTo } = renderFilters();

    type(search(), 'gold ');
    act(() => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(router.replace).toHaveBeenCalledWith('/?q=gold', noScroll);

    navigateTo({ q: 'gold' });

    expect(search()).toHaveValue('gold '); // the trailing space survives, so "gold r" can follow
  });
});
