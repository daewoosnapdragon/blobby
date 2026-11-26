import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NonWatchQuestion } from '@/lib/questions/schema';
import { QuestionPlayer } from '@/components/questions/QuestionPlayer';
import { spokenStrings } from '@/lib/spoken';

vi.mock('@/lib/sound', async (orig) => ({ ...(await orig<typeof import('@/lib/sound')>()), playSound: vi.fn() }));
vi.mock('@/components/usePracticePing', async (orig) => ({ ...(await orig<typeof import('@/components/usePracticePing')>()), markActive: vi.fn() }));

const pick: NonWatchQuestion = { type: 'pick_one', prompt: 'Pick the right sentence.', choices: ['I am happy.', 'I is happy.'], answer: 0 };
const play = (audio: Record<string, string>) =>
  render(<QuestionPlayer questions={[{ id: 'q1', question: pick, audio }]} onAnswer={vi.fn()} onFinish={vi.fn()} blobColor="mint" stars={0} />);

describe('Hear it while read-aloud is off', () => {
  it('is not shown when the question has no audio', () => {
    play({});
    expect(screen.queryByRole('button', { name: /hear it/i })).toBeNull();
  });

  it('is shown when the question has audio', () => {
    const audio = Object.fromEntries(spokenStrings(pick).map((t) => [t, `http://a/${encodeURIComponent(t)}.mp3`]));
    play(audio);
    expect(screen.getByRole('button', { name: 'Hear it' })).toBeInTheDocument();
  });
});
