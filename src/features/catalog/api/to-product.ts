import { toCents } from '@/lib/money';
import type { ApiProduct } from '../schemas/api-product';
import type { Product } from '../types';

/** The only place an API price becomes cents (data-model §2). */
export function toProduct(api: ApiProduct): Product {
  return {
    id: api.id,
    title: api.title,
    priceCents: toCents(api.price),
    description: api.description,
    category: api.category,
    imageUrl: api.image,
    rating: { rate: api.rating.rate, count: api.rating.count },
  };
}
