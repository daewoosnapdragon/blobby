import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ children, href, ...p }: { children: React.ReactNode; href: string }) => <a href={href} {...p}>{children}</a> }));
vi.mock('@/app/teacher/editorActions', () => ({ deleteQuestionAction: vi.fn(), saveQuestionAction: vi.fn() }));

import { QuestionAnswers } from '@/app/teacher/editor/QuestionAnswers';
import { EditorView } from '@/app/teacher/editor/EditorView';
import type { Question } from '@/lib/questions/schema';

/** The marked right answer (the label is visually hidden; its parent holds the answer text). */
const right = () => {
  const el = screen.getByText('right answer:', { exact: false }).parentElement as HTMLElement;
  return { text: (el.textContent ?? '').replace('right answer:', '').trim() };
};

describe('QuestionAnswers shows a question in full', () => {
  it('pick the right one: every choice, the right one marked', () => {
    render(<QuestionAnswers question={{ type: 'pick_one', prompt: 'Pick the right sentence.', choices: ['I is happy.', 'I am happy.'], answer: 1 }} />);
    expect(screen.getByText('Pick the right sentence.')).toBeInTheDocument();
    expect(screen.getByText('I is happy.')).toBeInTheDocument();
    expect(right().text).toBe('I am happy.');
  });

  it('fill the blank: the sentence with the right word in it, and the other choices', () => {
    render(<QuestionAnswers question={{ type: 'fill_blank', before: 'I see', after: 'owl in the tree.', choices: ['a', 'an', 'two'], answer: 1 }} />);
    expect(right().text).toBe('an');
    expect(screen.getByText(/I see/)).toBeInTheDocument();
    expect(screen.getByText('Other choices:', { exact: false })).toHaveTextContent('a, two');
  });

  it('find and fix: the wrong word, its fix, and the other fixes', () => {
    render(<QuestionAnswers question={{ type: 'find_fix', words: ['Tom', 'ate', 'a', 'apple.'], wrongIndex: 2, fixes: ['two', 'an', 'many'], answer: 1 }} />);
    expect(screen.getByText('a', { selector: 'del' })).toBeInTheDocument();
    expect(right().text).toBe('an');
    expect(screen.getByText('Other fixes:', { exact: false })).toHaveTextContent('two, many');
  });

  it('build it: the finished sentence and the extra tiles', () => {
    render(<QuestionAnswers question={{ type: 'build_it', prompt: 'Build the sentence.', tiles: ['I', 'ate', 'an', 'apple.'], distractors: ['a'] }} />);
    expect(right().text).toBe('I ate an apple.');
    expect(screen.getByText('Extra tiles:', { exact: false })).toHaveTextContent('a');
  });

  it('sort it: each group with its words', () => {
    render(<QuestionAnswers question={{ type: 'sort_it', prompt: 'Sort the words.', groups: ['a', 'an'], items: [{ text: 'egg', group: 1 }, { text: 'cup', group: 0 }, { text: 'owl', group: 1 }] }} />);
    const an = screen.getByRole('list', { name: 'an' });
    expect(within(an).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['egg', 'owl']);
    expect(within(screen.getByRole('list', { name: 'a' })).getByText('cup')).toBeInTheDocument();
  });

  it('watch and answer: the video and each follow-up question', () => {
    const q: Question = { type: 'watch_answer', youtubeId: 'dQw4w9WgXcQ', questions: [{ type: 'pick_one', prompt: 'Which one?', choices: ['x', 'y'], answer: 0 }] };
    render(<QuestionAnswers question={q} />);
    expect(screen.getByText('Video', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Which one?')).toBeInTheDocument();
  });
});

describe('EditorView question list', () => {
  const data = {
    lesson: { id: '00000000-0000-4000-8000-000000000301', title: 'A or an?', position: 1 },
    week: { id: 'w', position: 1, skill: 'a / an' },
    plan: { id: 'p', title: 'Test week · Grade 2' },
    questions: [{ id: '00000000-0000-4000-8000-000000000401', position: 1, type: 'pick_one', question: { type: 'pick_one', prompt: 'Pick one.', choices: ['an egg', 'a egg'], answer: 0 }, audioMissing: true }],
  } as never;

  it('shows each question in full, with Edit and Delete', () => {
    render(<EditorView data={data} />);
    expect(screen.getByText('an egg', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit question 1' })).toBeInTheDocument();
  });

  it('does not show audio warnings while read-aloud is off', () => {
    render(<EditorView data={data} />);
    expect(screen.queryByText(/No audio yet/)).toBeNull();
  });
});
