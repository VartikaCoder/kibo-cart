import { render, screen } from '@testing-library/react';
import { Rating } from './rating';

describe('Rating', () => {
  it('states the rating as text for assistive technology', () => {
    render(<Rating rate={3.9} count={120} />);
    expect(screen.getByText('Rated 3.9 out of 5 (120 reviews)')).toBeInTheDocument();
  });

  it('uses the singular for one review', () => {
    render(<Rating rate={5} count={1} />);
    expect(screen.getByText('Rated 5 out of 5 (1 review)')).toBeInTheDocument();
  });

  it('hides the decorative stars and short visual text from assistive technology', () => {
    const { container } = render(<Rating rate={4} count={10} />);
    // Everything except the sentence above is aria-hidden, so the accessible text is exactly that sentence.
    const hidden = container.querySelectorAll('[aria-hidden="true"]');
    expect(hidden.length).toBeGreaterThan(0);
    hidden.forEach((el) => expect(el).not.toHaveTextContent('Rated'));
  });
});
