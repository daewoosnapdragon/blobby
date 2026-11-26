import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseQuestion, type NonWatchQuestion } from '@/lib/questions/schema';
import { checkAnswer } from '@/lib/questions/check';
import { spokenStrings } from '@/lib/spoken';
import { tallyLines } from '@/lib/tally';
import { answerLine } from '@/lib/feedbackLines';
import { TYPE_NAMES, draftFromQuestion, draftToPayload, emptyDraft } from '@/lib/questions/draft';
import { OddOneOut } from '@/components/questions/OddOneOut';
import { QuestionPlayer } from '@/components/questions/QuestionPlayer';
import { TypeForm } from '@/app/teacher/editor/TypeForms';
import { QuestionAnswers } from '@/app/teacher/editor/QuestionAnswers';
import { questionProblems } from '@/lib/questions/problems';

vi.mock('@/lib/sound', async (orig) => ({ ...(await orig<typeof import('@/lib/sound')>()), playSound: vi.fn() }));

afterEach(cleanup);

type OO = Extract<NonWatchQuestion, { type: 'odd_one_out' }>;
const words = ['walk', 'walked', 'jumped', 'played'];
const oo = parseQuestion('odd_one_out', { prompt: 'Which word doesn’t belong?', words, answer: 0 }) as OO;

describe('odd_one_out', () => {
  it('schema: three or four words, no repeats, answer in range', () => {
    expect(oo).toEqual({ type: 'odd_one_out', prompt: 'Which word doesn’t belong?', words, answer: 0 });
    expect(parseQuestion('odd_one_out', { prompt: 'p', words: ['a', 'b', 'c'], answer: 2 })).toBeTruthy();
    expect(() => parseQuestion('odd_one_out', { prompt: 'p', words: ['a', 'b'], answer: 0 })).toThrow();
    expect(() => parseQuestion('odd_one_out', { prompt: 'p', words: ['a', 'b', 'c', 'd', 'e'], answer: 0 })).toThrow();
    expect(() => parseQuestion('odd_one_out', { prompt: 'p', words: ['a', 'b', 'a'], answer: 0 })).toThrow();
    expect(() => parseQuestion('odd_one_out', { prompt: 'p', words: ['a', 'b', 'c'], answer: 3 })).toThrow();
    expect(() => parseQuestion('odd_one_out', { words: ['a', 'b', 'c'], answer: 0 })).toThrow();
  });

  it('checkAnswer: choice matches answer', () => {
    expect(checkAnswer(oo, { choice: 0 })).toBe(true);
    expect(checkAnswer(oo, { choice: 1 })).toBe(false);
    expect(checkAnswer(oo, { choice: 0.5 })).toBe(false);
    expect(checkAnswer(oo, { yes: true })).toBe(false);
  });

  it('component: a word grid; tapping answers once', () => {
    const onAnswer = vi.fn();
    const { container, rerender } = render(<OddOneOut q={oo} status="idle" onAnswer={onAnswer} />);
    expect(container.querySelector('[data-count="4"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'walk' }));
    expect(onAnswer).toHaveBeenCalledWith(true);
    rerender(<OddOneOut q={oo} status="right" onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole('button', { name: 'walked' }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('component: marks the tapped word when locked', () => {
    const onAnswer = vi.fn();
    const { rerender } = render(<OddOneOut q={oo} status="idle" onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole('button', { name: 'jumped' }));
    expect(onAnswer).toHaveBeenCalledWith(false);
    rerender(<OddOneOut q={oo} status="wrong" onAnswer={onAnswer} />);
    expect(screen.getByRole('button', { name: 'jumped' })).toHaveAttribute('data-mark', 'wrong');
    expect(screen.getByRole('button', { name: 'walk' })).not.toHaveAttribute('data-mark');
  });

  it('player: tag reads Odd one out; prompt in the bubble; spoken strings', () => {
    render(<QuestionPlayer questions={[{ id: 'q', question: oo }]} onAnswer={vi.fn()} onFinish={vi.fn()} blobColor="mint" stars={0} />);
    expect(screen.getByText('Odd one out')).toBeInTheDocument();
    expect(document.getElementById('q-ask')).toHaveTextContent('Which word doesn’t belong?');
    expect(spokenStrings(oo)).toEqual(['Which word doesn’t belong?', 'walk', 'walked', 'jumped', 'played']);
  });

  it('player: a miss shows the odd_one_out hint', () => {
    render(<QuestionPlayer questions={[{ id: 'q', question: oo }]} onAnswer={vi.fn()} onFinish={vi.fn()} blobColor="mint" stars={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'walked' }));
    expect(screen.getByText('Say each word. Which one is different?')).toBeInTheDocument();
  });

  it('answerLine names the odd word, punctuation trimmed', () => {
    expect(answerLine({ type: 'odd_one_out', prompt: 'p', words: ['walk', 'walked', 'jumped', 'played'], answer: 0 })).toBe('“walk” doesn’t belong!');
    expect(answerLine({ type: 'odd_one_out', prompt: 'p', words: ['cat', 'dog', 'run.'], answer: 2 })).toBe('“run” doesn’t belong!');
  });

  it('tally copy', () => {
    expect(tallyLines({ odd_one_out: 1 })).toEqual(['You spotted 1 odd one']);
    expect(tallyLines({ odd_one_out: 2 })).toEqual(['You spotted 2 odd ones']);
  });

  it('draft round trip and empty draft', () => {
    expect(parseQuestion('odd_one_out', draftToPayload(draftFromQuestion(oo)))).toEqual(oo);
    expect(emptyDraft('odd_one_out')).toEqual({ type: 'odd_one_out', picture: '', prompt: '', words: ['', '', ''], answer: -1 });
    expect(draftToPayload({ type: 'odd_one_out', picture: '', prompt: ' p ', words: ['a', '', 'b', 'c'], answer: 3 }))
      .toEqual({ prompt: 'p', words: ['a', 'b', 'c'], answer: 2 });
    expect(TYPE_NAMES.odd_one_out).toBe('Odd one out');
  });

  it('editor problems: an empty draft gives readable problems; a repeat names the word', () => {
    expect(questionProblems('odd_one_out', draftToPayload(emptyDraft('odd_one_out'))))
      .toEqual(['Prompt: fill this in.', 'Add at least 3 words.', 'Pick the odd one.']);
    expect(questionProblems('odd_one_out', { prompt: 'p', words: ['a', 'b', 'a'], answer: 1 }))
      .toEqual(['Word 3: is the same as word 1.']);
  });

  it('editor problems: inside watch and answer, an odd one out still names its words and its pick', () => {
    expect(questionProblems('watch_answer', { youtubeId: 'dQw4w9WgXcQ', questions: [{ type: 'odd_one_out', prompt: 'p', words: ['a', 'b', 'a'], answer: 1 }] }))
      .toEqual(['Question 1, Word 3: is the same as word 1.']);
    expect(questionProblems('watch_answer', { youtubeId: 'dQw4w9WgXcQ', questions: [{ type: 'odd_one_out', prompt: 'p', words: ['a', 'b', 'c'], answer: -1 }] }))
      .toEqual(['Pick the odd one.']);
  });

  it('editor form: Instruction and the Words list with a radio per word', () => {
    const onChange = vi.fn();
    render(<TypeForm draft={emptyDraft('odd_one_out')} onChange={onChange} />);
    expect(screen.getByLabelText('Instruction')).toHaveAttribute('placeholder', 'Which word doesn’t belong?');
    expect(screen.getByRole('group', { name: 'Words' })).toBeInTheDocument();
    expect(screen.getByText('Three or four words. Select the odd one.')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('Word 2'), { target: { value: 'walked' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ words: ['', 'walked', ''] }));
    fireEvent.click(screen.getByRole('radio', { name: 'Word 1 is the right answer' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ answer: 0 }));
    fireEvent.click(screen.getByRole('button', { name: /Add a word/ }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ words: ['', '', '', ''] }));
  });

  it('editor form: no Add past four words, no Remove below three', () => {
    render(<TypeForm draft={{ type: 'odd_one_out', picture: '', prompt: '', words: ['a', 'b', 'c', 'd'], answer: -1 }} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Add a word/ })).toBeDisabled();
    cleanup();
    render(<TypeForm draft={emptyDraft('odd_one_out')} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Remove word 1' })).toBeDisabled();
  });

  it('answer summary shows the prompt and marks the odd one', () => {
    render(<QuestionAnswers question={oo} />);
    expect(screen.getByText('Which word doesn’t belong?')).toBeInTheDocument();
    expect(screen.getByText('right answer:').parentElement).toHaveTextContent('walk');
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });
});
