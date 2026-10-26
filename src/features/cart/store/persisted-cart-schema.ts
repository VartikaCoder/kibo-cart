import { z } from 'zod';
import { ImageUrlSchema } from '@/lib/image-url';
import type { Cents } from '@/lib/money';
import { MAX_QTY_PER_LINE } from '@/lib/stock';

// This schema runs in the browser. Zod v4 otherwise probes `new Function` to see if it can JIT-compile
// validators; the CSP blocks eval, so every saved-cart read would report a CSP violation. Same validation.
z.config({ jitless: true });

/**
 * The saved cart in localStorage, version 1 (contracts/persisted-cart.md). Untrusted: users and extensions
 * can edit it. Any failure invalidates the whole payload; nothing is repaired or defaulted.
 */
const PersistedLineSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE),
  unitPriceCents: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .transform((cents) => cents as Cents),
  title: z.string().max(300).regex(/\S/, 'title must not be blank'),
  imageUrl: ImageUrlSchema,
});

export const MAX_PERSISTED_LINES = 100;

export const PersistedCartSchema = z.object({
  lines: z
    .array(PersistedLineSchema)
    .max(MAX_PERSISTED_LINES)
    // Unlike the catalogue (first wins), duplicates here mean the payload can't be trusted at all.
    .refine((lines) => new Set(lines.map((l) => l.productId)).size === lines.length, 'duplicate productId'),
});

export type PersistedCart = z.infer<typeof PersistedCartSchema>;
