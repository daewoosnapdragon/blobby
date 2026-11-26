import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { trickyToday } from '@/lib/tricky';
import { TrickyToday } from '@/app/(kid)/lesson/[id]/TrickyToday';
import { QuestionPlayer } from '@/components/questions/QuestionPlayer';
import type { NonWatchQuestion } from '@/lib/questions/schema';

vi.mock('@/lib/sound', async (orig) => ({ ...(await orig<typeof import('@/lib/sound')>()), playSound: vi.fn() }));
vi.mock('@/components/usePracticePing', async (orig) => ({ ...(await orig<typeof import('@/components/usePracticePing')>()), markActive: vi.fn() }));
vi.mock('next/link', () => ({ default: ({ children, href, ...p }: { children: React.ReactNode; href: string }) => <a href={href} {...p}>{children}</a> }));

describe('trickyToday', () => {
  it('lists skills missed 2 or more times, most missed first, at most 2', () => {
    const answers = [
      { skill: 'articles', right: false }, { skill: 'articles', right: false }, { skill: 'articles', right: false },
      { skill: 'past-tense', right: false }, { skill: 'past-tense', right: false },
      { skill: 'plurals', right: false }, { skill: 'plurals', right: false },
      { skill: 'be', right: false }, { skill: 'be', right: true },
      { skill: null, right: false }, { skill: null, right: false },
    ];
    expect(trickyToday(answers)).toEqual(['articles', 'past-tense']);
  });
  it('ignores unknown skills and gives nothing for a good lesson', () => {
    expect(trickyToday([{ skill: 'magic', right: false }, { skill: 'magic', right: false }])).toEqual([]);
    expect(trickyToday([{ skill: 'be', right: true }])).toEqual([]);
  });
});

describe('TrickyToday card', () => {
  it('names each tricky skill in kid words, with Practice again', () => {
    render(<TrickyToday skills={['past-tense']} />);
    expect(screen.getByText('Tricky today')).toBeInTheDocument();
    expect(screen.getByText('past tense (played, walked)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Practice again: past tense (played, walked)' })).toHaveAttribute('href', '/practice?skill=past-tense');
  });
  it('cheers when nothing was tricky, with no scores', () => {
    const { container } = render(<TrickyToday skills={[]} />);
    expect(screen.getByText('Nothing tricky today!')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d/);
  });
});

describe('Just for you label', () => {
  const pick: NonWatchQuestion = { type: 'pick_one', prompt: 'Pick.', choices: ['went', 'goed'], answer: 0 };
  it('shows on review questions only', () => {
    const { rerender } = render(<QuestionPlayer questions={[{ id: 'q1', question: pick, forYou: true }]} onAnswer={vi.fn()} onFinish={vi.fn()} blobColor="mint" stars={0} />);
    expect(screen.getByText('Just for you')).toBeInTheDocument();
    rerender(<QuestionPlayer questions={[{ id: 'q2', question: pick }]} onAnswer={vi.fn()} onFinish={vi.fn()} blobColor="mint" stars={0} />);
    expect(screen.queryByText('Just for you')).toBeNull();
  });
});
