import { useCallback, useEffect, useRef } from 'react';

/** One pending callback at a time: `schedule` replaces any pending one, `cancel` drops it. Cleared on unmount. */
export function useDebouncedTimer(delayMs: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const schedule = useCallback(
    (callback: () => void) => {
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        callback();
      }, delayMs);
    },
    [cancel, delayMs],
  );

  useEffect(() => cancel, [cancel]);

  return { schedule, cancel };
}
