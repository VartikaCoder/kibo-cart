import { Skeleton } from '@/components/ui/skeleton';
import { ProductGridSkeleton } from './product-grid-skeleton';

/** Reserves the filters and summary rows too, so the real listing replaces it without shifting. */
export function CatalogueLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-[4.25rem] w-full" />
      <Skeleton className="h-5 w-32" />
      <ProductGridSkeleton />
    </div>
  );
}
