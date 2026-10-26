'use client';

import { type MouseEvent, type ReactNode, useEffect, useId, useRef } from 'react';
import { IconButton } from './icon-button';
import { CloseIcon } from './icons';

interface DrawerProps {
  id?: string;
  open: boolean;
  onClose(): void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}

/**
 * A side panel on the native modal `<dialog>` (research R9). `showModal()` makes the rest of the page inert,
 * so focus is contained by the browser; Esc closes it natively. On close, focus returns to whatever was
 * focused when it opened (the trigger).
 */
export function Drawer({ id, open, onClose, title, closeLabel, children }: DrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Sync the `open` prop to the dialog's imperative API (an external system, hence an effect).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Every close path we control reports to the parent *synchronously*; the effect above then closes the
  // dialog. Browsers fire the native `close` event later (a queued task), so state must not wait for it:
  // in that gap the dialog is shut while state says open, and a quick reopen click would be lost.
  function requestClose() {
    if (open) onClose();
  }

  // Native `close`: restore focus, and catch any close path we didn't initiate.
  function handleNativeClose() {
    returnFocusTo.current?.focus();
    returnFocusTo.current = null;
    if (open && !dialogRef.current?.open) onClose();
  }

  // A click on the dialog element itself (not its content) is a click on the backdrop.
  function onBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) requestClose();
  }

  return (
    <dialog
      id={id}
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={requestClose}
      onClose={handleNativeClose}
      onClick={onBackdropClick}
      className={
        'ml-auto mr-0 h-dvh max-h-dvh w-full max-w-full bg-surface p-0 text-ink backdrop:bg-black/50 sm:w-[28rem] ' +
        'open:flex open:flex-col'
      }
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <IconButton label={closeLabel} onClick={requestClose}>
          <CloseIcon />
        </IconButton>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </dialog>
  );
}
