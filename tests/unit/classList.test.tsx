import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClassListView } from '@/app/teacher/views';

describe('teacher class page', () => {
  it('notes that days and time include the in-class test weeks', () => {
    const row = { studentId: 's1', displayName: 'Mina', blobColor: 'mint', stars: 10, daysPracticed: 3, secondsPracticed: 600, weeksDone: 1, lastSkill: 'Plurals' };
    render(<ClassListView classId="c1" className="Snapdragon G1" classCode="ABC234" rows={[row]} sort="name" />);
    expect(screen.getByText('Days and time include the in-class test weeks.')).toBeInTheDocument();
  });
});
