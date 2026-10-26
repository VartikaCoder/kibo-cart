import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Rating } from '@/components/ui/rating';
import { formatMoney } from '@/lib/money';
import type { Product } from '../types';

export const CARD_IMAGE_SIZES = '(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw';

interface ProductCardProps {
  product: Product;
  /** Load eagerly with high priority: the first row is likely the LCP element. */
  priority?: boolean;
}

/** Text from the API is rendered as React text children only, never as HTML (FR-014). */
export function ProductCard({ product, priority = false }: ProductCardProps) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="relative aspect-square bg-white">
        <Image
          src={product.imageUrl}
          alt={product.title}
          fill
          sizes={CARD_IMAGE_SIZES}
          className="object-contain p-6"
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Badge>{product.category}</Badge>
        <h2 className="line-clamp-2 min-h-10 text-sm font-medium leading-5">{product.title}</h2>
        <Rating rate={product.rating.rate} count={product.rating.count} />
        <p className="mt-auto text-lg font-semibold">{formatMoney(product.priceCents)}</p>
      </div>
    </article>
  );
}
