import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClassListView } from '@/app/teacher/views';
import { PracticeBar } from '@/components/ui/PracticeBar';

const noop = async () => {};

describe('class page practice-student buttons', () => {
  it('offers Try it as a student and Reset practice student for this class', () => {
    const { container } = render(<ClassListView classId="c1" className="Snapdragon G1" classCode="ABC234" rows={[]} sort="name" tryAction={noop} resetAction={noop} />);
    expect(screen.getByRole('button', { name: 'Try it as a student' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset practice student' })).toBeInTheDocument();
    const ids = [...container.querySelectorAll('input[name="classId"]')].map((i) => (i as HTMLInputElement).value);
    expect(ids).toEqual(['c1', 'c1']);
  });

  it('confirms a reset', () => {
    render(<ClassListView classId="c1" className="Snapdragon G1" classCode="ABC234" rows={[]} sort="name" tryAction={noop} resetAction={noop} reset />);
    expect(screen.getByRole('status')).toHaveTextContent('The practice student is back to a fresh start.');
  });
});

describe('PracticeBar', () => {
  it('says this is a practice student and links back to the class', () => {
    render(<PracticeBar classId="c1" />);
    expect(screen.getByText("You're trying this as a student.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to your class' })).toHaveAttribute('href', '/teacher/class/c1');
  });
});
