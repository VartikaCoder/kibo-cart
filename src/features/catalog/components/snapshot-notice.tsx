'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { InfoIcon } from '@/components/ui/icons';

/**
 * How old the snapshot is, already formatted on the server. Passing strings (not a Date to format here)
 * means the server and the first client render show identical text: no hydration mismatch.
 */
export interface SnapshotAge {
  /** "2 hours ago" */
  relative: string;
  /** "Oct 26, 2026, 2:20 PM UTC", for the title attribute. */
  absolute: string;
  /** ISO 8601, for `<time dateTime>`. */
  iso: string;
}

interface SnapshotNoticeProps {
  /** Server Action that expires the cached catalogue (`refreshCatalogue`). */
  retryAction: () => Promise<void>;
  /** Omitted when the capture time is unknown. */
  age?: SnapshotAge | null;
}

/** Non-blocking: the listing stays usable underneath. `role="status"` is a polite live region. */
export function SnapshotNotice({ retryAction, age = null }: SnapshotNoticeProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function retry() {
    if (isPending) return;
    startTransition(async () => {
      await retryAction();
      router.refresh();
    });
  }

  return (
    // Informational, not a warning: neutral tones and a slim single row; the listing below stays usable.
    <div
      role="status"
      className="flex items-center gap-2 rounded-md border border-info-border bg-info py-1 pl-3 pr-1 text-sm text-info-ink"
    >
      <InfoIcon className="size-4 shrink-0 text-info-muted" />
      <p className="min-w-0 flex-1 py-1.5">
        <span>
          Showing a saved copy of the catalogue
          {age && (
            <>
              {' '}
              from{' '}
              <time dateTime={age.iso} title={age.absolute}>
                {age.relative}
              </time>
            </>
          )}
          .
        </span>{' '}
        <span className="text-info-muted">Prices may be out of date.</span>
      </p>
      {/* aria-disabled rather than disabled, so focus isn't dropped while retrying. */}
      <Button variant="ghost" size="sm" onClick={retry} aria-disabled={isPending} className="shrink-0">
        {isPending ? 'Retrying…' : 'Retry'}
      </Button>
    </div>
  );
}
