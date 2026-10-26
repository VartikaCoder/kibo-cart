import '@testing-library/jest-dom';

// jsdom (v26) has no HTMLDialogElement.showModal/close. This minimal stand-in toggles `open` and fires
// `close` the way browsers do: asynchronously, as a queued task (HTML spec). Real modal behaviour (inert
// background, focus containment, Esc → `cancel`) is the browser's and is covered by Playwright.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    setTimeout(() => this.dispatchEvent(new Event('close')), 0);
  };
}

