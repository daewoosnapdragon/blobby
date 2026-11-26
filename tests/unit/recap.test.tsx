import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Recap } from '@/components/ui/Recap';

describe('Recap', () => {
  it('shows up to three recap tags and nothing for an empty tally', () => {
    render(<Recap tally={{ build_it: 3, find_fix: 4, sort_it: 12, pick_one: 1 }} />);
    const items = within(screen.getByTestId('recap')).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(['You sorted 12 words', 'You fixed 4 mistakes', 'You built 3 sentences']);
    expect(render(<Recap tally={{}} />).container).toBeEmptyDOMElement();
    expect(render(<Recap tally={null} />).container).toBeEmptyDOMElement();
  });
});
