import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseQuestion, type NonWatchQuestion } from '@/lib/questions/schema';
import { checkAnswer } from '@/lib/questions/check';
import { spokenStrings } from '@/lib/spoken';
import { addToTally, tallyLines } from '@/lib/tally';
import { TYPE_NAMES, draftFromQuestion, draftToPayload, draftWords, emptyDraft, type NonWatchDraft } from '@/lib/questions/draft';
import { TapAll } from '@/components/questions/TapAll';
import { QuestionPlayer } from '@/components/questions/QuestionPlayer';
import { TypeForm } from '@/app/teacher/editor/TypeForms';
import { QuestionAnswers } from '@/app/teacher/editor/QuestionAnswers';
import { questionProblems } from '@/lib/questions/problems';

vi.mock('@/lib/sound', async (orig) => ({ ...(await orig<typeof import('@/lib/sound')>()), playSound: vi.fn() }));

afterEach(cleanup);

type TA = Extract<NonWatchQuestion, { type: 'tap_all' }>;
type TD = Extract<NonWatchDraft, { type: 'tap_all' }>;
const words = ['The', 'dog', 'ate', 'my', 'shoe.'];
const ta = parseQuestion('tap_all', { prompt: 'Tap every noun.', words, answers: [4, 1] }) as TA;
const word = (name: string) => screen.getByRole('button', { name });

describe('tap_all', () => {
  it('schema: two or more words, answers in range, no duplicates, at least one answer', () => {
    expect(ta).toEqual({ type: 'tap_all', prompt: 'Tap every noun.', words, answers: [4, 1] });
    expect(() => parseQuestion('tap_all', { prompt: 'p', words: ['a'], answers: [0] })).toThrow();
    expect(() => parseQuestion('tap_all', { prompt: 'p', words: ['a', 'b'], answers: [] })).toThrow();
    expect(() => parseQuestion('tap_all', { prompt: 'p', words: ['a', 'b'], answers: [2] })).toThrow();
    expect(() => parseQuestion('tap_all', { prompt: 'p', words: ['a', 'b'], answers: [1, 1] })).toThrow(/is repeated/);
    expect(() => parseQuestion('tap_all', { prompt: 'p', words: ['a', 'b'], answers: [0.5] })).toThrow();
    expect(() => parseQuestion('tap_all', { words: ['a', 'b'], answers: [0] })).toThrow();
  });

  it('checkAnswer: compares the tapped set with the answers', () => {
    const q = { ...ta, answers: [3, 1] };
    expect(checkAnswer(q, { tapped: [1, 3] })).toBe(true);
    expect(checkAnswer(q, { tapped: [3, 1] })).toBe(true);
    expect(checkAnswer(q, { tapped: [1] })).toBe(false);
    expect(checkAnswer(q, { tapped: [1, 3, 0] })).toBe(false);
    expect(checkAnswer(q, { tapped: [1, 1] })).toBe(false);
    expect(checkAnswer(q, { tapped: [1, 3.5] } as never)).toBe(false);
    expect(checkAnswer(q, { tapped: 1, fix: 3 })).toBe(false);
    expect(checkAnswer(q, { choice: 1 })).toBe(false);
  });

  it('checkAnswer: tapping every word is not right when the answers are a strict subset', () => {
    expect(checkAnswer(ta, { tapped: [0, 1, 2, 3, 4] })).toBe(false);
  });

  it('component: Check appears after the first tap and goes when all are untapped', () => {
    render(<TapAll q={ta} status="idle" onAnswer={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Sentence' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
    fireEvent.click(word('dog'));
    expect(word('dog')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Check' })).toBeInTheDocument();
    fireEvent.click(word('dog'));
    expect(word('dog')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
  });

  it('component: Check sends the tapped set; right marks every tapped word right', () => {
    const onAnswer = vi.fn();
    const { rerender } = render(<TapAll q={ta} status="idle" onAnswer={onAnswer} />);
    fireEvent.click(word('shoe.'));
    fireEvent.click(word('dog'));
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(onAnswer).toHaveBeenCalledWith(true);
    rerender(<TapAll q={ta} status="right" onAnswer={onAnswer} />);
    expect(word('dog')).toHaveAttribute('data-mark', 'right');
    expect(word('shoe.')).toHaveAttribute('data-mark', 'right');
    expect(word('ate')).not.toHaveAttribute('data-mark');
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
    fireEvent.click(word('ate'));
    expect(word('ate')).toHaveAttribute('aria-pressed', 'false');
  });

  it('component: a miss marks only what is off, and Try again keeps the board', () => {
    const onAnswer = vi.fn();
    const { rerender } = render(<TapAll q={ta} status="idle" onAnswer={onAnswer} />);
    fireEvent.click(word('dog'));
    fireEvent.click(word('ate'));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(onAnswer).toHaveBeenCalledWith(false);
    rerender(<TapAll q={ta} status="wrong" onAnswer={onAnswer} />);
    expect(word('ate')).toHaveAttribute('data-mark', 'wrong');
    expect(word('dog')).toHaveAttribute('data-mark', 'selected');
    expect(word('shoe.')).not.toHaveAttribute('data-mark');
    expect(word('The')).not.toHaveAttribute('data-mark');
    rerender(<TapAll q={ta} status="idle" onAnswer={onAnswer} />);
    expect(word('dog')).toHaveAttribute('aria-pressed', 'true');
    expect(word('ate')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Check' })).toBeInTheDocument();
  });

  it('player: tag reads Tap them all; prompt in the bubble; spoken strings', () => {
    render(<QuestionPlayer questions={[{ id: 'q', question: ta }]} onAnswer={vi.fn()} onFinish={vi.fn()} blobColor="mint" stars={0} />);
    expect(screen.getByText('Tap them all')).toBeInTheDocument();
    expect(document.getElementById('q-ask')).toHaveTextContent('Tap every noun.');
    expect(spokenStrings(ta)).toEqual(['Tap every noun.', 'The dog ate my shoe.']);
  });

  it('player: a miss shows the tap_all hint, and Try again keeps the pressed words', () => {
    render(<QuestionPlayer questions={[{ id: 'q', question: ta }]} onAnswer={vi.fn()} onFinish={vi.fn()} blobColor="mint" stars={0} />);
    fireEvent.click(word('dog'));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Look at every word. Did you miss one?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(word('dog')).toHaveAttribute('aria-pressed', 'true');
  });

  it('tally: adds the number of answers', () => {
    const q5 = parseQuestion('tap_all', { prompt: 'p', words: ['a', 'b', 'c', 'd', 'e', 'f'], answers: [0, 1, 2, 3, 4] }) as TA;
    expect(tallyLines(addToTally({}, q5))).toEqual(['You tapped 5 words']);
    expect(tallyLines({ tap_all: 1 })).toEqual(['You tapped 1 word']);
  });

  it('draft round trip and empty draft', () => {
    expect(parseQuestion('tap_all', draftToPayload(draftFromQuestion(ta)))).toEqual({ ...ta, answers: [1, 4] });
    expect(draftFromQuestion(ta)).toEqual({ type: 'tap_all', picture: '', prompt: 'Tap every noun.', sentence: 'The dog ate my shoe.', answers: [4, 1] });
    expect(emptyDraft('tap_all')).toEqual({ type: 'tap_all', picture: '', prompt: '', sentence: '', answers: [] });
    const d: TD = { type: 'tap_all', picture: '', prompt: ' p ', sentence: '  a  b c ', answers: [5, 2, 0] };
    expect(draftToPayload(d)).toEqual({ prompt: 'p', words: ['a', 'b', 'c'], answers: [0, 2] });
    expect(draftWords(d)).toBe(' p    a  b c ');
    expect(TYPE_NAMES.tap_all).toBe('Tap them all');
  });

  it('editor problems: an empty draft gives readable problems', () => {
    expect(questionProblems('tap_all', draftToPayload(emptyDraft('tap_all'))))
      .toEqual(['Prompt: fill this in.', 'Add at least 2 words.', 'Tap at least one word.']);
    expect(questionProblems('watch_answer', { youtubeId: 'dQw4w9WgXcQ', questions: [{ type: 'tap_all', prompt: 'p', words: ['a', 'b'], answers: [] }] }))
      .toEqual(['Tap at least one word.']);
  });

  it('editor form: Instruction, Sentence, and a checkbox chip per word', () => {
    const onChange = vi.fn();
    const d: TD = { type: 'tap_all', picture: '', prompt: '', sentence: 'The dog ate', answers: [1] };
    render(<TypeForm draft={d} onChange={onChange} />);
    expect(screen.getByLabelText('Instruction')).toHaveAttribute('placeholder', 'Tap every noun.');
    expect(screen.getByText('Type the whole sentence.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Which words?' })).toBeInTheDocument();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    expect(screen.getByRole('checkbox', { name: 'dog' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'ate' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ answers: [1, 2] }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'dog' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ answers: [] }));
    fireEvent.change(screen.getByLabelText('Sentence'), { target: { value: 'The' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ sentence: 'The', answers: [] }));
  });

  it('editor form: no sentence yet shows a hint instead of chips', () => {
    render(<TypeForm draft={emptyDraft('tap_all')} onChange={vi.fn()} />);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('answer summary: prompt, then the sentence with each answer marked', () => {
    render(<QuestionAnswers question={ta} />);
    expect(screen.getByText('Tap every noun.')).toBeInTheDocument();
    const marked = screen.getAllByText('right answer:').map((el) => el.parentElement!.textContent);
    expect(marked).toEqual(['right answer: dog', 'right answer: shoe.']);
  });
});
