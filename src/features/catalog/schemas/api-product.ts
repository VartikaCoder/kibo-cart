import { z } from 'zod';
import { ImageUrlSchema } from '@/lib/image-url';

/**
 * Mirrors one item of GET https://fakestoreapi.com/products, and nothing more (data-model §1).
 * The API has no inventory data, so there is deliberately no `stock` field.
 * No `.catch()` / `.default()`: an item that fails any rule is dropped by the caller, never repaired.
 */
export const ApiProductSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().trim().min(1),
  price: z.number().nonnegative(),
  description: z.string(),
  category: z.string().trim().min(1),
  image: ImageUrlSchema,
  rating: z.object({
    rate: z.number().min(0).max(5),
    count: z.number().int().nonnegative(),
  }),
});

export type ApiProduct = z.infer<typeof ApiProductSchema>;
