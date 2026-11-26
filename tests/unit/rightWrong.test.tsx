import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseQuestion, type NonWatchQuestion } from '@/lib/questions/schema';
import { checkAnswer } from '@/lib/questions/check';
import { spokenStrings } from '@/lib/spoken';
import { tallyLines } from '@/lib/tally';
import { TYPE_NAMES, draftFromQuestion, draftToPayload, emptyDraft } from '@/lib/questions/draft';
import { RightWrong } from '@/components/questions/RightWrong';
import { QuestionPlayer } from '@/components/questions/QuestionPlayer';
import { TypeForm } from '@/app/teacher/editor/TypeForms';
import { QuestionAnswers } from '@/app/teacher/editor/QuestionAnswers';
import { questionProblems } from '@/lib/questions/problems';

vi.mock('@/lib/sound', async (orig) => ({ ...(await orig<typeof import('@/lib/sound')>()), playSound: vi.fn() }));

afterEach(cleanup);

type RW = Extract<NonWatchQuestion, { type: 'right_wrong' }>;
const rw = parseQuestion('right_wrong', { sentence: 'She don’t like carrots.', right: false }) as RW;

describe('right_wrong', () => {
  it('schema: default prompt, boolean right, rejects a missing sentence', () => {
    expect(rw).toEqual({ type: 'right_wrong', prompt: 'Is this sentence right?', sentence: 'She don’t like carrots.', right: false });
    expect(() => parseQuestion('right_wrong', { sentence: 'x', right: 'yes' })).toThrow();
    expect(() => parseQuestion('right_wrong', { right: true })).toThrow();
  });

  it('checkAnswer: yes matches right', () => {
    expect(checkAnswer(rw, { yes: false })).toBe(true);
    expect(checkAnswer(rw, { yes: true })).toBe(false);
    expect(checkAnswer(rw, { choice: 0 })).toBe(false);
  });

  it('component: shows the sentence; Yes/No buttons answer once and lock', () => {
    const onAnswer = vi.fn();
    const { container, rerender } = render(<RightWrong q={rw} status="idle" onAnswer={onAnswer} />);
    expect(screen.getByText('She don’t like carrots.')).toBeInTheDocument();
    // one stack root, so the sentence card and the buttons get the same gap as every other type
    expect(container.childElementCount).toBe(1);
    expect((container.firstElementChild as HTMLElement).className).toMatch(/stack/);
    fireEvent.click(screen.getByRole('button', { name: /No/ }));
    expect(onAnswer).toHaveBeenCalledWith(true);
    expect(onAnswer).toHaveBeenCalledTimes(1);
    rerender(<RightWrong q={rw} status="right" onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole('button', { name: /Yes/ }));
    fireEvent.click(screen.getByRole('button', { name: /No/ }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('component: marks the tapped button when locked', () => {
    const onAnswer = vi.fn();
    const { rerender } = render(<RightWrong q={rw} status="idle" onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole('button', { name: /Yes/ }));
    expect(onAnswer).toHaveBeenCalledWith(false);
    rerender(<RightWrong q={rw} status="wrong" onAnswer={onAnswer} />);
    expect(screen.getByRole('button', { name: /Yes/ })).toHaveAttribute('data-mark', 'wrong');
    expect(screen.getByRole('button', { name: /No/ })).not.toHaveAttribute('data-mark');
  });

  it('player: tag reads Yes or no; prompt in the bubble; spoken strings', () => {
    render(<QuestionPlayer questions={[{ id: 'q', question: rw }]} onAnswer={vi.fn()} onFinish={vi.fn()} blobColor="mint" stars={0} />);
    expect(screen.getByText('Yes or no')).toBeInTheDocument();
    // the bubble's ask (#q-ask; a hidden sizer copy sits beside it)
    expect(document.getElementById('q-ask')).toHaveTextContent('Is this sentence right?');
    expect(screen.getByText('She don’t like carrots.')).toBeInTheDocument();
    expect(spokenStrings(rw)).toEqual(['Is this sentence right?', 'She don’t like carrots.']);
  });

  it('player: a miss shows the right_wrong hint', () => {
    render(<QuestionPlayer questions={[{ id: 'q', question: rw }]} onAnswer={vi.fn()} onFinish={vi.fn()} blobColor="mint" stars={0} />);
    fireEvent.click(screen.getByRole('button', { name: /Yes/ }));
    expect(screen.getByText('Read it once more, slowly.')).toBeInTheDocument();
  });

  it('editor problems: a missing answer reads "Pick Yes or No."; a blank sentence names Sentence', () => {
    expect(questionProblems('right_wrong', { sentence: 'x' })).toEqual(['Pick Yes or No.']);
    expect(questionProblems('right_wrong', draftToPayload(emptyDraft('right_wrong')))).toEqual(['Sentence: fill this in.', 'Pick Yes or No.']);
  });

  it('tally copy', () => {
    expect(tallyLines({ right_wrong: 1 })).toEqual(['You checked 1 sentence']);
    expect(tallyLines({ right_wrong: 3 })).toEqual(['You checked 3 sentences']);
  });

  it('draft round trip and empty draft invalid', () => {
    const d = draftFromQuestion(rw);
    expect(parseQuestion('right_wrong', draftToPayload(d))).toEqual(rw);
    expect(emptyDraft('right_wrong')).toEqual({ type: 'right_wrong', picture: '', prompt: 'Is this sentence right?', sentence: '', right: null });
    expect(draftToPayload(emptyDraft('right_wrong'))).not.toHaveProperty('right');
    expect(() => parseQuestion('right_wrong', draftToPayload(emptyDraft('right_wrong')))).toThrow();
    expect(TYPE_NAMES.right_wrong).toBe('Right or wrong');
  });

  it('editor form renders Question, Sentence and the Yes/No radios', () => {
    const onChange = vi.fn();
    render(<TypeForm draft={emptyDraft('right_wrong')} onChange={onChange} />);
    expect(screen.getByLabelText('Question')).toHaveValue('Is this sentence right?');
    expect(screen.getByLabelText('Sentence')).toHaveAttribute('placeholder', 'She don’t like carrots.');
    expect(screen.getByRole('group', { name: 'Is it right?' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Sentence'), { target: { value: 'She doesn’t like carrots.' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ sentence: 'She doesn’t like carrots.' }));
    fireEvent.click(screen.getByRole('radio', { name: 'No' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ right: false }));
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ right: true }));
  });

  it('answer summary shows the sentence and Not right', () => {
    render(<QuestionAnswers question={rw} />);
    expect(screen.getByText('She don’t like carrots.')).toBeInTheDocument();
    expect(screen.getByText('Not right')).toBeInTheDocument();
    cleanup();
    render(<QuestionAnswers question={{ ...rw, right: true }} />);
    expect(screen.getByText('Right')).toBeInTheDocument();
  });
});
