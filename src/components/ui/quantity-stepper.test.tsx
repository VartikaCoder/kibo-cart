import { fireEvent, render, screen } from '@testing-library/react';
import { QuantityStepper } from './quantity-stepper';

function renderStepper(value: number, max = 5) {
  const handlers = { onIncrease: jest.fn(), onDecrease: jest.fn(), onCommit: jest.fn() };
  render(
    <QuantityStepper
      value={value}
      max={max}
      increaseLabel="Increase quantity of Mug"
      decreaseLabel="Decrease quantity of Mug"
      inputLabel="Quantity of Mug"
      limitMessage="Only 5 available (demo inventory)"
      {...handlers}
    />,
  );
  return {
    ...handlers,
    increase: () => screen.getByRole('button', { name: 'Increase quantity of Mug' }),
    input: () => screen.getByRole('textbox', { name: 'Quantity of Mug' }),
  };
}

describe('QuantityStepper', () => {
  it('names every control and shows the value', () => {
    const { input } = renderStepper(2);
    expect(screen.getByRole('button', { name: 'Decrease quantity of Mug' })).toBeInTheDocument();
    expect(input()).toHaveValue('2');
  });

  it('at the max, marks "+" aria-disabled (still focusable) and links the visible reason', () => {
    const { increase, onIncrease } = renderStepper(5);

    expect(increase()).toHaveAttribute('aria-disabled', 'true');
    expect(increase()).not.toBeDisabled();
    expect(increase()).toHaveAccessibleDescription('Only 5 available (demo inventory)');

    // Still reports the click, so the caller can announce why nothing changed.
    fireEvent.click(increase());
    expect(onIncrease).toHaveBeenCalledTimes(1);
  });

  it('below the max, "+" is enabled with no limit text', () => {
    const { increase } = renderStepper(4);
    expect(increase()).toHaveAttribute('aria-disabled', 'false');
    expect(screen.queryByText('Only 5 available (demo inventory)')).not.toBeInTheDocument();
  });

  it.each([
    ['Enter', (el: HTMLElement) => fireEvent.keyDown(el, { key: 'Enter' })],
    ['blur', (el: HTMLElement) => fireEvent.blur(el)],
  ])('commits typed text on %s, then shows the current value again', (_label, finish) => {
    const { input, onCommit } = renderStepper(2);

    fireEvent.change(input(), { target: { value: 'abc' } });
    finish(input());

    expect(onCommit).toHaveBeenCalledWith('abc');
    expect(input()).toHaveValue('2'); // the parent rejected it, so the value didn't change
  });

  it('Escape abandons the edit without committing', () => {
    const { input, onCommit } = renderStepper(2);
    fireEvent.change(input(), { target: { value: '4' } });
    fireEvent.keyDown(input(), { key: 'Escape' });
    fireEvent.blur(input());

    expect(onCommit).not.toHaveBeenCalled();
    expect(input()).toHaveValue('2');
  });
});
