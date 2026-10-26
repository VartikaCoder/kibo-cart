import { pageWindow } from './page-window';

describe('pageWindow', () => {
  it('lists every page when there are 7 or fewer', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it.each([
    [1, 42, [1, 2, 'gap', 42]],
    [2, 42, [1, 2, 3, 'gap', 42]],
    [3, 42, [1, 2, 3, 4, 'gap', 42]],
    [20, 42, [1, 'gap', 19, 20, 21, 'gap', 42]],
    [40, 42, [1, 'gap', 39, 40, 41, 42]],
    [42, 42, [1, 'gap', 41, 42]],
  ])('page %p of %p → %p', (page, total, expected) => {
    expect(pageWindow(page, total)).toEqual(expected);
  });

  it('never replaces a single hidden page with a gap', () => {
    // Between 1 and 3 only page 2 is hidden; showing "2" is shorter than "…".
    expect(pageWindow(4, 10)).toEqual([1, 2, 3, 4, 5, 'gap', 10]);
  });
});
