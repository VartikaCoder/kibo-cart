import { delay, http, HttpResponse } from 'msw';
import { PRODUCTS_URL } from '@/features/catalog/api/fetch-catalogue';

/** A valid API item. Override fields to build invalid ones. */
export function apiProduct(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    title: 'Fjallraven - Foldsack No. 1 Backpack, Fits 15 Laptops',
    price: 109.95,
    description: 'Your perfect pack for everyday use and walks in the forest.',
    category: "men's clothing",
    image: 'https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_t.png',
    rating: { rate: 3.9, count: 120 },
    ...overrides,
  };
}

export const validProducts = [
  apiProduct(),
  apiProduct({ id: 2, title: 'Mens Casual Premium Slim Fit T-Shirts', price: 22.3, rating: { rate: 4.1, count: 259 } }),
  apiProduct({ id: 9, title: 'WD 2TB Elements Portable External Hard Drive', price: 64, category: 'electronics' }),
];

export const productsHandlers = {
  success: (body: unknown[] = validProducts) => http.get(PRODUCTS_URL, () => HttpResponse.json(body)),
  serverError: () => http.get(PRODUCTS_URL, () => new HttpResponse(null, { status: 500 })),
  forbidden: () => http.get(PRODUCTS_URL, () => new HttpResponse('Forbidden', { status: 403 })),
  /** 200 with a body that isn't JSON (e.g. an HTML error page from a proxy). */
  malformedJson: () =>
    http.get(PRODUCTS_URL, () => new HttpResponse('<html>oops</html>', { headers: { 'Content-Type': 'application/json' } })),
  /** 200 with valid JSON in the wrong shape. */
  notAnArray: () => http.get(PRODUCTS_URL, () => HttpResponse.json({ products: validProducts })),
  empty: () => http.get(PRODUCTS_URL, () => HttpResponse.json([])),
  networkError: () => http.get(PRODUCTS_URL, () => HttpResponse.error()),
  hang: () =>
    http.get(PRODUCTS_URL, async () => {
      await delay('infinite');
      return HttpResponse.json(validProducts);
    }),
};

/** Default: the API is healthy. Tests opt into failures with `server.use(productsHandlers.x())`. */
export const handlers = [productsHandlers.success()];
