import type { ButtonHTMLAttributes, Ref } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'sm';

const base =
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60';

// `sm` stays well above the 24×24px minimum target size (WCAG 2.5.8).
const sizes: Record<ButtonSize, string> = {
  md: 'min-h-11 px-4',
  sm: 'min-h-9 px-3',
};

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
  secondary: 'border border-border bg-surface text-ink hover:bg-canvas',
  ghost: 'text-accent underline-offset-4 hover:underline',
};

/** Shared so links that look like buttons (e.g. "Clear filters") stay visually consistent. */
export function buttonClassName(variant: ButtonVariant = 'primary', className = '', size: ButtonSize = 'md'): string {
  return `${base} ${sizes[size]} ${variants[variant]} ${className}`.trim();
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClassName(variant, className, size)} {...props} />;
}
