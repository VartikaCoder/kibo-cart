import { Button } from '@/components/ui/button';

/** Shown when every catalogue source failed. Details stay in server logs; the copy never echoes the error. */
export function CatalogueError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 rounded-lg border border-border bg-surface px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">We couldn’t load the products</h2>
      <p className="max-w-md text-ink-muted">The store is temporarily unavailable. Please try again in a moment.</p>
      <Button onClick={onRetry}>Try again</Button>
    </div>
  );
}
