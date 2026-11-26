import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseQuestion, type NonWatchQuestion } from '@/lib/questions/schema';
import { checkAnswer } from '@/lib/questions/check';
import { spokenStrings } from '@/lib/spoken';
import { tallyLines } from '@/lib/tally';
import { TYPE_NAMES, draftFromQuestion, draftToPayload, draftWords, emptyDraft, type NonWatchDraft } from '@/lib/questions/draft';
import { PictureFirst } from '@/components/questions/PictureFirst';
import { QuestionPlayer } from '@/components/questions/QuestionPlayer';
import { TypeForm } from '@/app/teacher/editor/TypeForms';
import { QuestionAnswers } from '@/app/teacher/editor/QuestionAnswers';
import { PicturePicker } from '@/app/teacher/editor/PicturePicker';
import { questionProblems } from '@/lib/questions/problems';

vi.mock('@/lib/sound', async (orig) => ({ ...(await orig<typeof import('@/lib/sound')>()), playSound: vi.fn() }));

afterEach(cleanup);

type PF = Extract<NonWatchQuestion, { type: 'picture_first' }>;
const choices = ['ice cream', 'cake', 'cookie'];
const pf = parseQuestion('picture_first', { picture: 'ice-cream', choices, answer: 0 }) as PF;
const bigImg = () => document.querySelector('img[alt="ice cream"]') as HTMLImageElement | null;

describe('picture_first', () => {
  it('schema: picture required and validated, default prompt, two to four choices', () => {
    expect(pf).toEqual({ type: 'picture_first', picture: 'ice-cream', prompt: 'Which one matches the picture?', choices, answer: 0 });
    expect(parseQuestion('picture_first', { picture: 'cat', prompt: 'Which word?', choices: ['a', 'b', 'c', 'd'], answer: 3 }))
      .toMatchObject({ prompt: 'Which word?' });
    expect(() => parseQuestion('picture_first', { choices: ['a', 'b'], answer: 0 })).toThrow(/picture: is not a picture name/);
    expect(() => parseQuestion('picture_first', { picture: 'Ice Cream', choices: ['a', 'b'], answer: 0 })).toThrow(/picture/);
    expect(() => parseQuestion('picture_first', { picture: 'cat', choices: ['a'], answer: 0 })).toThrow();
    expect(() => parseQuestion('picture_first', { picture: 'cat', choices: ['a', 'b', 'c', 'd', 'e'], answer: 0 })).toThrow();
    expect(() => parseQuestion('picture_first', { picture: 'cat', choices: ['a', 'b', 'a'], answer: 0 })).toThrow();
    expect(() => parseQuestion('picture_first', { picture: 'cat', choices: ['a', 'b'], answer: 2 })).toThrow();
  });

  it('checkAnswer: choice matches answer', () => {
    expect(checkAnswer(pf, { choice: 0 })).toBe(true);
    expect(checkAnswer(pf, { choice: 1 })).toBe(false);
    expect(checkAnswer(pf, { yes: true })).toBe(false);
  });

  it('component: a 160px picture with the name as alt, then options; tapping answers once', () => {
    const onAnswer = vi.fn();
    const { container, rerender } = render(<PictureFirst q={pf} status="idle" onAnswer={onAnswer} />);
    const img = bigImg()!;
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('/pictures/ice-cream.svg');
    expect(img).toHaveAttribute('width', '160');
    expect(img).toHaveAttribute('height', '160');
    expect(img.closest('[class*="bigPicture"]')).not.toBeNull();
    expect(container.querySelector('[data-short]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /cake/ }));
    expect(onAnswer).toHaveBeenCalledWith(false);
    rerender(<PictureFirst q={pf} status="wrong" onAnswer={onAnswer} />);
    expect(screen.getByRole('button', { name: /cake/ })).toHaveAttribute('data-mark', 'wrong');
    fireEvent.click(screen.getByRole('button', { name: /ice cream/ }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('component: a picture that fails to load says so, never names it, and Show it again reloads it', () => {
    const q = { ...pf, choices: ['a', 'b'] };
    const { container } = render(<PictureFirst q={q} status="idle" onAnswer={vi.fn()} />);
    fireEvent.error(bigImg()!);
    expect(bigImg()).toBeNull();
    expect(screen.getByText('The picture didn’t load')).toBeInTheDocument();
    expect(container.querySelector('[class*="pictureMissing"]')).not.toBeNull();
    expect(container.textContent).not.toMatch(/ice.cream/i);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show it again' }));
    expect(screen.queryByText('The picture didn’t load')).toBeNull();
    expect(bigImg()!.getAttribute('src')).toBe('/pictures/ice-cream.svg?retry=1');
  });

  it('component: a picture that failed before hydration (complete, no pixels) shows the fallback, not the name', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
    try {
      const { container } = render(<PictureFirst q={{ ...pf, choices: ['a', 'b'] }} status="idle" onAnswer={vi.fn()} />);
      expect(bigImg()).toBeNull();
      expect(screen.getByText('The picture didn’t load')).toBeInTheDocument();
      expect(container.textContent).not.toMatch(/ice.cream/i);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('component: a loaded viewBox-only SVG that reports naturalWidth 0 stays shown when decode() succeeds', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
    const decode = vi.fn(() => Promise.resolve());
    Object.defineProperty(HTMLImageElement.prototype, 'decode', { value: decode, configurable: true });
    try {
      render(<PictureFirst q={pf} status="idle" onAnswer={vi.fn()} />);
      await act(async () => {});
      expect(decode).toHaveBeenCalled();
      expect(bigImg()).not.toBeNull();
      expect(screen.queryByText('The picture didn’t load')).toBeNull();
    } finally {
      delete (HTMLImageElement.prototype as { decode?: unknown }).decode;
      vi.restoreAllMocks();
    }
  });

  it('component: a complete image whose decode() rejects shows the fallback', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
    Object.defineProperty(HTMLImageElement.prototype, 'decode', { value: () => Promise.reject(new Error('broken')), configurable: true });
    try {
      render(<PictureFirst q={pf} status="idle" onAnswer={vi.fn()} />);
      await act(async () => {});
      expect(bigImg()).toBeNull();
      expect(screen.getByText('The picture didn’t load')).toBeInTheDocument();
    } finally {
      delete (HTMLImageElement.prototype as { decode?: unknown }).decode;
      vi.restoreAllMocks();
    }
  });

  it('player: tag, prompt, no small bubble picture, the big picture; spoken strings', () => {
    const { container } = render(<QuestionPlayer questions={[{ id: 'q', question: pf }]} onAnswer={vi.fn()} onFinish={vi.fn()} blobColor="mint" stars={0} />);
    expect(screen.getByText('Picture first')).toBeInTheDocument();
    expect(document.getElementById('q-ask')).toHaveTextContent('Which one matches the picture?');
    expect(container.querySelector('[class*="qPicture"]')).toBeNull();
    expect(bigImg()).not.toBeNull();
    expect(spokenStrings(pf)).toEqual(['Which one matches the picture?', 'ice cream', 'cake', 'cookie']);
  });

  it('player: a miss shows the picture_first hint', () => {
    render(<QuestionPlayer questions={[{ id: 'q', question: pf }]} onAnswer={vi.fn()} onFinish={vi.fn()} blobColor="mint" stars={0} />);
    fireEvent.click(screen.getByRole('button', { name: /cake/ }));
    expect(screen.getByText('Look at the picture again.')).toBeInTheDocument();
  });

  it('player: inside watch and answer the big picture renders after the video', () => {
    render(<QuestionPlayer questions={[{ id: 'w', question: { type: 'watch_answer', youtubeId: 'dQw4w9WgXcQ', questions: [pf] } }]}
      onAnswer={vi.fn()} onFinish={vi.fn()} blobColor="mint" stars={0} />);
    expect(bigImg()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(bigImg()).not.toBeNull();
    expect(document.querySelector('[class*="qPicture"]')).toBeNull();
  });

  it('player: bare (editor preview) renders the big picture', () => {
    render(<QuestionPlayer bare questions={[{ id: 'q', question: pf }]} onAnswer={vi.fn()} onFinish={vi.fn()} blobColor="mint" stars={0} />);
    expect(bigImg()).not.toBeNull();
  });

  it('tally copy', () => {
    expect(tallyLines({ picture_first: 1 })).toEqual(['You matched 1 picture']);
    expect(tallyLines({ picture_first: 4 })).toEqual(['You matched 4 pictures']);
  });

  it('draft round trip; the empty draft is invalid because the picture is missing', () => {
    expect(parseQuestion('picture_first', draftToPayload(draftFromQuestion(pf)))).toEqual(pf);
    const empty = emptyDraft('picture_first') as Extract<NonWatchDraft, { type: 'picture_first' }>;
    expect(empty).toEqual({ type: 'picture_first', picture: '', prompt: 'Which one matches the picture?', choices: ['', ''], answer: -1 });
    expect(draftToPayload(empty)).not.toHaveProperty('picture');
    expect(() => parseQuestion('picture_first', draftToPayload({ ...empty, choices: ['a', 'b'], answer: 0 }))).toThrow(/picture: is not a picture name/);
    expect(draftToPayload({ type: 'picture_first', picture: 'cat', prompt: ' p ', choices: ['a', '', 'b'], answer: 2 }))
      .toEqual({ prompt: 'p', choices: ['a', 'b'], answer: 1, picture: 'cat' });
    expect(draftWords({ type: 'picture_first', picture: 'cat', prompt: 'Which?', choices: ['cat', 'dog'], answer: 0 })).toBe('Which? cat dog');
    expect(TYPE_NAMES.picture_first).toBe('Picture first');
  });

  it('editor problems: a missing picture reads Pick a picture., also inside watch and answer', () => {
    expect(questionProblems('picture_first', { choices: ['a', 'b'], answer: 0 })).toContain('Pick a picture.');
    expect(questionProblems('picture_first', { picture: 'Bad Name', choices: ['a', 'b'], answer: 0 })).toEqual(['Pick a picture.']);
    expect(questionProblems('picture_first', draftToPayload(emptyDraft('picture_first'))))
      .toEqual(['Pick a picture.', 'Add at least 2 choices.', 'Pick the right answer.']);
    expect(questionProblems('watch_answer', { youtubeId: 'dQw4w9WgXcQ', questions: [{ type: 'picture_first', choices: ['a', 'b'], answer: 0 }] }))
      .toEqual(['Pick a picture.']);
  });

  it('editor form: Question and the Choices list', () => {
    const onChange = vi.fn();
    render(<TypeForm draft={emptyDraft('picture_first')} onChange={onChange} />);
    expect(screen.getByLabelText('Question')).toHaveValue('Which one matches the picture?');
    expect(screen.getByRole('group', { name: 'Choices' })).toBeInTheDocument();
    expect(screen.getByText('Two to four. Select the one that matches the picture.')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Choice 1'), { target: { value: 'cat' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ choices: ['cat', ''] }));
    fireEvent.click(screen.getByRole('radio', { name: 'Choice 2 is the right answer' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ answer: 1 }));
  });

  it('picture picker: required shows "Required for picture first" instead of optional', () => {
    const { container } = render(<PicturePicker text="" value="" onChange={vi.fn()} catalog={[]} required />);
    const legend = container.querySelector('legend')!;
    expect(legend).toHaveTextContent('Picture');
    expect(legend).not.toHaveTextContent('(optional)');
    expect(screen.getByText('Required for picture first')).toBeInTheDocument();
    expect(screen.getByText('This picture is the question. Pick the thing the right answer names.')).toBeInTheDocument();
    expect(screen.queryByText(/Show a picture of the key word/)).toBeNull();
    cleanup();
    const plain = render(<PicturePicker text="" value="" onChange={vi.fn()} catalog={[]} />);
    expect(plain.container.querySelector('legend')).toHaveTextContent('Picture (optional)');
    expect(screen.queryByText('Required for picture first')).toBeNull();
    expect(screen.getByText(/Show a picture of the key word/)).toBeInTheDocument();
  });

  it('answer summary: picture, prompt, choices with the right one marked', () => {
    render(<QuestionAnswers question={pf} />);
    expect(screen.getByRole('img', { name: 'Picture: ice cream' })).toHaveAttribute('width', '48');
    expect(screen.getByText('Which one matches the picture?')).toBeInTheDocument();
    expect(screen.getByText('right answer:').parentElement).toHaveTextContent('ice cream');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});
