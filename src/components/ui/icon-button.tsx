import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  /** Required: an icon-only button has no visible text, so this is its whole accessible name. */
  label: string;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({ label, children, className = '', type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={
        'inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-ink ' +
        'hover:bg-canvas aria-disabled:cursor-not-allowed aria-disabled:opacity-50 ' +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}
