'use client';

import { type KeyboardEvent, type Ref, useId, useState } from 'react';
import { IconButton } from './icon-button';
import { MinusIcon, PlusIcon, TrashIcon } from './icons';

interface QuantityStepperProps {
  value: number;
  max: number;
  increaseLabel: string;
  decreaseLabel: string;
  inputLabel: string;
  /** Shown, and linked to the increase button, while `value >= max`. */
  limitMessage: string;
  /** At the lowest quantity, decreasing removes the item: show a trash icon instead of a minus. */
  decreaseRemoves?: boolean;
  onIncrease(): void;
  onDecrease(): void;
  /** The raw typed text, on Enter or blur. The caller validates it; an invalid value simply doesn't change `value`. */
  onCommit(raw: string): void;
  increaseRef?: Ref<HTMLButtonElement>;
}

/**
 * − [input] + with no knowledge of what is being counted. At the max, "+" is `aria-disabled` rather than
 * `disabled`: it stays focusable and clickable, so the caller can announce why it can't go higher.
 */
export function QuantityStepper({
  value,
  max,
  increaseLabel,
  decreaseLabel,
  inputLabel,
  limitMessage,
  decreaseRemoves = false,
  onIncrease,
  onDecrease,
  onCommit,
  increaseRef,
}: QuantityStepperProps) {
  const id = useId();
  const atMax = value >= max;
  // Text being typed; null when not editing, so the input shows the current value.
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    onCommit(draft);
    setDraft(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') commit();
    if (event.key === 'Escape') setDraft(null);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <IconButton label={decreaseLabel} onClick={onDecrease}>
          {decreaseRemoves ? <TrashIcon className="size-4" /> : <MinusIcon className="size-4" />}
        </IconButton>
        <label htmlFor={`${id}-qty`} className="sr-only">
          {inputLabel}
        </label>
        <input
          id={`${id}-qty`}
          inputMode="numeric"
          autoComplete="off"
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          className="h-11 w-12 rounded-md border border-border bg-surface text-center text-sm tabular-nums"
        />
        <IconButton
          ref={increaseRef}
          label={increaseLabel}
          onClick={onIncrease}
          aria-disabled={atMax}
          aria-describedby={atMax ? `${id}-limit` : undefined}
        >
          <PlusIcon className="size-4" />
        </IconButton>
      </div>
      {atMax && (
        <p id={`${id}-limit`} className="text-xs text-ink-muted">
          {limitMessage}
        </p>
      )}
    </div>
  );
}
