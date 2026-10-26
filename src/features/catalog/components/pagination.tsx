import Link from 'next/link';
import type { CatalogueQuery } from '../schemas/catalogue-query';
import { pageWindow } from '../query/page-window';
import { catalogueHref, withQuery } from '../query/serialize-catalogue-query';

interface PaginationProps {
  page: number;
  totalPages: number;
  query: CatalogueQuery;
}

const itemClass = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm';
const linkClass = `${itemClass} border border-border bg-surface hover:bg-canvas`;
const currentClass = `${itemClass} border border-accent bg-accent font-semibold text-accent-ink`;

export function Pagination({ page, totalPages, query }: PaginationProps) {
  if (totalPages <= 1) return null;
  const href = (p: number) => catalogueHref(withQuery(query, { page: p }));

  return (
    <nav aria-label="Pagination">
      <ul role="list" className="flex flex-wrap items-center justify-center gap-2">
        {page > 1 && (
          <li>
            <Link href={href(page - 1)} className={linkClass} rel="prev">
              Previous
            </Link>
          </li>
        )}
        {pageWindow(page, totalPages).map((item, i) =>
          item === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-ink-muted">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={href(item)}
                className={item === page ? currentClass : linkClass}
                aria-current={item === page ? 'page' : undefined}
                aria-label={`Page ${item}`}
              >
                {item}
              </Link>
            </li>
          ),
        )}
        {page < totalPages && (
          <li>
            <Link href={href(page + 1)} className={linkClass} rel="next">
              Next
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
