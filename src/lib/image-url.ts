import { z } from 'zod';

/**
 * Product images must be `https:` on fakestoreapi.com: next/image `remotePatterns` allows only that host
 * and throws on any other. Shared by every boundary that accepts an image URL (API, persisted cart).
 */
export const ImageUrlSchema = z.url({ protocol: /^https$/, hostname: /^fakestoreapi\.com$/ });
