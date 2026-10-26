import { Skeleton } from '@/components/ui/skeleton';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { GRID_CLASS } from './product-grid';

/** Same box sizes as ProductCard so swapping in real cards causes no layout shift. */
function CardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <Skeleton className="aspect-square rounded-none" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Skeleton className="h-5.5 w-24 rounded-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-5 w-28" />
        <Skeleton className="mt-auto h-7 w-20" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div role="status" aria-busy="true">
      <VisuallyHidden>Loading products…</VisuallyHidden>
      <div aria-hidden="true" className={GRID_CLASS}>
        {Array.from({ length: count }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
