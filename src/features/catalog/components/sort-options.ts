import type { SortKey } from '../schemas/catalogue-query';

export const SORT_LABELS: Record<SortKey, string> = {
  featured: 'Featured',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  'rating-desc': 'Rating: high to low',
  'rating-asc': 'Rating: low to high',
  'name-asc': 'Name: A to Z',
  'name-desc': 'Name: Z to A',
};
