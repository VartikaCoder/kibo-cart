import { act, fireEvent, render, screen } from '@testing-library/react';
import { router } from '@/test/next-navigation';
import { SnapshotNotice } from './snapshot-notice';

jest.mock('next/navigation', () => jest.requireActual('@/test/next-navigation').nextNavigationMock);

function deferred() {
  let resolve!: () => void; // assigned synchronously by the Promise executor below
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe('SnapshotNotice', () => {
  it('tells the shopper the catalogue may be stale, in a polite status region', () => {
    render(<SnapshotNotice retryAction={jest.fn(async () => {})} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Showing a saved copy of the catalogue. Prices may be out of date.',
    );
  });

  it('Retry expires the cache, then refreshes the page', async () => {
    const pending = deferred();
    const retryAction = jest.fn(() => pending.promise);
    render(<SnapshotNotice retryAction={retryAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(retryAction).toHaveBeenCalledTimes(1);
    expect(router.refresh).not.toHaveBeenCalled(); // not before the cache is expired
    expect(await screen.findByRole('button', { name: 'Retrying…' })).toHaveAttribute('aria-disabled', 'true');

    await act(async () => pending.resolve());

    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveAttribute('aria-disabled', 'false');
  });

  it('ignores repeated clicks while a retry is in flight', async () => {
    const pending = deferred();
    const retryAction = jest.fn(() => pending.promise);
    render(<SnapshotNotice retryAction={retryAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Retrying…' }));
    await act(async () => pending.resolve());

    expect(retryAction).toHaveBeenCalledTimes(1);
  });
});
