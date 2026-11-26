import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ReviewSkills } from '@/app/teacher/student/ReviewSkills';
import type { StudentSkillRow } from '@/lib/db/teacher';

const row = (skill: string, over: Partial<StudentSkillRow> = {}): StudentSkillRow => ({
  skill, source: 'pretest', state: 'active', spacing: 3, lessonsSince: 0, removedByTeacher: false,
  addedAt: '2026-11-20 10:00:00+00', changedAt: '2026-11-25 10:00:00+00', ...over,
});
const noop = vi.fn(async () => {});

describe('ReviewSkills', () => {
  it('lists working and mastered skills with where they came from', () => {
    render(<ReviewSkills studentId="s1" skills={[
      row('past-tense'), row('was-were', { source: 'auto' }), row('articles', { source: 'teacher' }),
      row('plurals', { state: 'mastered', spacing: 6 }), row('be', { source: 'next_step' }),
    ]} addAction={noop} removeAction={noop} />);
    const working = screen.getByRole('list', { name: 'Working on' });
    expect(within(working).getByText('Past tense')).toBeInTheDocument();
    expect(within(working).getByText('From the pretest')).toBeInTheDocument();
    expect(within(working).getByText('Added by practice')).toBeInTheDocument();
    expect(within(working).getByText('Added by you')).toBeInTheDocument();
    expect(within(working).getByText('Next step')).toBeInTheDocument();
    const mastered = screen.getByRole('list', { name: 'Mastered' });
    expect(within(mastered).getByText('Plurals')).toBeInTheDocument();
    expect(within(mastered).getByText('Comes back every 6th lesson')).toBeInTheDocument();
  });

  it('says 3rd, not 3th', () => {
    render(<ReviewSkills studentId="s1" skills={[row('plurals', { state: 'mastered', spacing: 3 })]} addAction={noop} removeAction={noop} />);
    expect(screen.getByText('Comes back every 3rd lesson')).toBeInTheDocument();
  });

  it('each skill has a Remove button for this student', () => {
    const { container } = render(<ReviewSkills studentId="s1" skills={[row('past-tense')]} addAction={noop} removeAction={noop} />);
    expect(screen.getByRole('button', { name: 'Remove Past tense' })).toBeInTheDocument();
    const hidden = [...container.querySelectorAll('input[type=hidden]')].map((i) => `${(i as HTMLInputElement).name}=${(i as HTMLInputElement).value}`);
    expect(hidden).toContain('studentId=s1');
    expect(hidden).toContain('skill=past-tense');
  });

  it('shows removed skills as Removed by you, and offers the rest to add', () => {
    render(<ReviewSkills studentId="s1" skills={[row('past-tense'), row('be', { state: 'removed', removedByTeacher: true })]} addAction={noop} removeAction={noop} />);
    expect(within(screen.getByRole('list', { name: 'Removed' })).getByText('am / is / are')).toBeInTheDocument();
    const select = screen.getByLabelText('Add a skill') as HTMLSelectElement;
    const options = [...select.options].map((o) => o.value);
    expect(options).not.toContain('past-tense');
    expect(options).toContain('be');
    expect(options).toContain('articles');
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('explains an empty track', () => {
    render(<ReviewSkills studentId="s1" skills={[]} addAction={noop} removeAction={noop} />);
    expect(screen.getByText(/No review skills yet/)).toBeInTheDocument();
  });
});
