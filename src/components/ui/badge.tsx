import type { ReactNode } from 'react';

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-ink-muted">
      {children}
    </span>
  );
}
