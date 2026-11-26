import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LessonData } from '@/lib/db/kid';
import type { ApiResult } from '@/lib/kidApi';

vi.mock('@/lib/sound', async (orig) => ({ ...(await orig<typeof import('@/lib/sound')>()), playSound: vi.fn() }));
vi.mock('@/components/usePracticePing', async (orig) => ({ ...(await orig<typeof import('@/components/usePracticePing')>()), usePracticePing: vi.fn(), markActive: vi.fn() }));
vi.mock('next/link', () => ({ default: ({ children, href, ...p }: { children: React.ReactNode; href: string }) => <a href={href} {...p}>{children}</a> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const calls: string[] = [];
let resolveAttempt: (r: ApiResult<unknown>) => void = () => {};
vi.mock('@/lib/kidApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/kidApi')>()),
  postWithRetry: vi.fn((url: string) => {
    calls.push(url);
    if (url === '/api/attempt') return new Promise((r) => { resolveAttempt = r; });
    return Promise.resolve({ status: 200, data: { starsAwarded: 12, weekDone: false, lessonStars: 10, bonusStars: 2, totalStars: 12, studentId: KID } });
  }),
}));

import { LessonDone } from '@/app/(kid)/lesson/[id]/LessonDone';
import { LessonScreen } from '@/app/(kid)/lesson/[id]/LessonScreen';
import { PracticeDone } from '@/app/(kid)/practice/PracticeDone';

const KID = '00000000-0000-4000-8000-000000000002';

describe('LessonDone', () => {
  it('shows the paid lesson stars, the bonus line only when paid, and the recap', () => {
    render(<LessonDone state={{ kind: 'saved', firstTime: true, nextHref: '/', starsBefore: 0, starsAfter: 12, lessonStars: 10, bonusStars: 2 }} name="Mina" color="mint" stars={0} onRetry={() => {}} tally={{ build_it: 2 }} />);
    expect(screen.getByText('+10 stars')).toBeInTheDocument();
    expect(screen.getByText('+2 bonus stars')).toBeInTheDocument();
    expect(screen.getByText('You built 2 sentences')).toBeInTheDocument();
  });
  it('hides the bonus line at 0', () => {
    render(<LessonDone state={{ kind: 'saved', firstTime: true, nextHref: '/', starsBefore: 0, starsAfter: 10, lessonStars: 10, bonusStars: 0 }} name="Mina" color="mint" stars={0} onRetry={() => {}} />);
    expect(screen.getByText('+10 stars')).toBeInTheDocument();
    expect(screen.queryByText(/bonus stars/)).toBeNull();
    expect(screen.queryByTestId('recap')).toBeNull();
  });
});

describe('PracticeDone', () => {
  it('shows the recap under the stars line', () => {
    render(<PracticeDone name="Mina" color="mint" stars={5} earned={3} saving={false} tally={{ build_it: 2 }} />);
    const starsLine = screen.getByText('You earned 3 stars');
    const recap = screen.getByTestId('recap');
    expect(recap).toHaveTextContent('You built 2 sentences');
    expect(starsLine.compareDocumentPosition(recap) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('LessonScreen', () => {
  const data: LessonData = {
    student: { id: KID, displayName: 'Mina', blobColor: 'mint', grade: 3 },
    totalStars: 0,
    lesson: { id: '00000000-0000-4000-8000-0000000000l1', title: 'L1', position: 1 },
    week: { id: '00000000-0000-4000-8000-0000000000w1', number: 1, skill: 'be', lessonCount: 2, done: false },
    lessonDone: false,
    otherLessonsDone: false,
    questions: [{ id: '00000000-0000-4000-8000-0000000000aa', audio: {}, question: { type: 'pick_one', prompt: 'Pick.', choices: ['went', 'goed'], answer: 0 } }],
  };

  it('waits for pending saves before lesson-complete', async () => {
    render(<LessonScreen data={data} />);
    fireEvent.click(screen.getByRole('button', { name: 'went' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await act(async () => {});
    expect(calls).toEqual(['/api/attempt']);
    await act(async () => { resolveAttempt({ status: 200, data: { starsAwarded: 0, studentId: KID } }); });
    await waitFor(() => expect(calls).toEqual(['/api/attempt', '/api/lesson-complete']));
    expect(await screen.findByText('+10 stars')).toBeInTheDocument();
    expect(screen.getByText('+2 bonus stars')).toBeInTheDocument();
    expect(screen.getByTestId('recap')).toBeInTheDocument();
  });
});
