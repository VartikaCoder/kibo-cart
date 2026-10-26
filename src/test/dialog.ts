import { act, fireEvent } from '@testing-library/react';

/** What a browser does on Escape in a modal dialog: fire `cancel`, then close unless it was prevented. */
export function pressEscapeOn(dialog: HTMLElement) {
  const notPrevented = fireEvent(dialog, new Event('cancel', { cancelable: true }));
  if (notPrevented && dialog instanceof HTMLDialogElement) act(() => dialog.close());
}
