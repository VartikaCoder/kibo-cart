import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { pressEscapeOn } from '@/test/dialog';
import { Drawer } from './drawer';

function Harness({ onClose = jest.fn() }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-expanded={open}>
        Open
      </button>
      <Drawer
        open={open}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        title="Your cart"
        closeLabel="Close cart"
      >
        <p>Contents</p>
      </Drawer>
    </>
  );
}

function openDrawer() {
  const trigger = screen.getByRole('button', { name: 'Open' });
  trigger.focus();
  fireEvent.click(trigger);
  return { trigger, dialog: screen.getByRole('dialog', { name: 'Your cart' }) };
}

describe('Drawer', () => {
  it('opens as a dialog labelled by its title', () => {
    render(<Harness />);
    expect(openDrawer().dialog).toHaveAttribute('open');
  });

  it.each([
    ['the close button', () => fireEvent.click(screen.getByRole('button', { name: 'Close cart' }))],
    ['the backdrop', () => fireEvent.click(screen.getByRole('dialog'))],
    ['Escape', () => pressEscapeOn(screen.getByRole('dialog'))],
  ])('closing via %s updates state at once, then returns focus to the trigger', async (_label, closeIt) => {
    const onClose = jest.fn();
    render(<Harness onClose={onClose} />);
    const { trigger } = openDrawer();

    closeIt();

    // Synchronously: browsers fire `close` later, so state must not wait for it (else a quick reopen is lost).
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(onClose).toHaveBeenCalledTimes(1); // the later `close` event doesn't report it twice
  });

  it('can be reopened immediately after closing', () => {
    render(<Harness />);
    const { trigger } = openDrawer();

    pressEscapeOn(screen.getByRole('dialog'));
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog', { name: 'Your cart' })).toHaveAttribute('open');
  });

  it('does not close on a click inside its content', () => {
    render(<Harness />);
    openDrawer();
    fireEvent.click(screen.getByText('Contents'));
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
  });
});
