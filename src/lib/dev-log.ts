export function devWarn(...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(...args);
  }
}
