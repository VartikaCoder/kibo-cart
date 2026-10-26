'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';

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
    <div
      role="status"
      className="flex flex-col gap-3 rounded-lg border border-notice-border bg-notice p-4 text-sm text-notice-ink sm:flex-row sm:items-center sm:justify-between"
    >
      <p>
        <strong className="font-semibold">
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
        </strong>{' '}
        Prices may be out of date.
      </p>
      {/* aria-disabled rather than disabled, so focus isn't dropped while retrying. */}
      <Button variant="secondary" onClick={retry} aria-disabled={isPending}>
        {isPending ? 'Retrying…' : 'Retry'}
      </Button>
    </div>
  );
}
