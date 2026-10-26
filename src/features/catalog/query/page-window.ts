export type PageWindowItem = number | 'gap';

/**
 * Page numbers to show: always the first, last, current, and its neighbours; gaps collapse to `'gap'`.
 * Small totals list every page. Keeps the control a bounded size for the large catalogue.
 */
export function pageWindow(page: number, totalPages: number): PageWindowItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const shown = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...shown].sort((a, b) => a - b);

  const items: PageWindowItem[] = [];
  sorted.forEach((p, i) => {
    const previous = sorted[i - 1];
    if (previous !== undefined && p - previous === 2) items.push(previous + 1);
    else if (previous !== undefined && p - previous > 2) items.push('gap');
    items.push(p);
  });
  return items;
}
