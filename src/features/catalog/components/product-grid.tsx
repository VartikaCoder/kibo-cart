import type { ReactNode } from 'react';
import type { Product } from '../types';
import { ProductCard } from './product-card';

/** Matches the widest breakpoint's column count, so the whole first row loads eagerly. */
const FIRST_ROW = 4;

export const GRID_CLASS = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <GridList>
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard product={product} priority={index < FIRST_ROW} />
        </li>
      ))}
    </GridList>
  );
}

export function GridList({ children }: { children: ReactNode }) {
  // role="list" restores list semantics that Safari drops when list-style is removed.
  return (
    <ul role="list" className={GRID_CLASS}>
      {children}
    </ul>
  );
}
