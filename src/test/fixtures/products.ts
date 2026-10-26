import type { Product } from '@/features/catalog';
import type { Cents } from '@/lib/money';

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    title: 'Fjallraven - Foldsack No. 1 Backpack, Fits 15 Laptops',
    priceCents: 10995 as Cents,
    description: 'Your perfect pack for everyday use and walks in the forest.',
    category: "men's clothing",
    imageUrl: 'https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_t.png',
    rating: { rate: 3.9, count: 120 },
    ...overrides,
  };
}

/** `count` products with distinct ids, cycling through a few categories. */
export function makeProducts(count: number): Product[] {
  const categories = ['electronics', 'jewelery', "men's clothing"];
  return Array.from({ length: count }, (_, i) =>
    makeProduct({
      id: i + 1,
      title: `Product ${String(i + 1).padStart(3, '0')}`,
      priceCents: ((i + 1) * 100) as Cents,
      category: categories[i % categories.length],
    }),
  );
}
