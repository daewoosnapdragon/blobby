import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseQuestion, type NonWatchQuestion } from '@/lib/questions/schema';
import { checkAnswer } from '@/lib/questions/check';
import { spokenStrings } from '@/lib/spoken';
import { addToTally, tallyLines } from '@/lib/tally';
import { TYPE_NAMES, draftFromQuestion, draftToPayload, draftWords, emptyDraft, type NonWatchDraft } from '@/lib/questions/draft';
import { MatchPairs } from '@/components/questions/MatchPairs';
import { SortIt } from '@/components/questions/SortIt';
import { GROUP_TINTS } from '@/components/questions/types';
import { QuestionPlayer } from '@/components/questions/QuestionPlayer';
import { TypeForm } from '@/app/teacher/editor/TypeForms';
import { QuestionAnswers } from '@/app/teacher/editor/QuestionAnswers';
import { questionProblems } from '@/lib/questions/problems';

vi.mock('@/lib/sound', async (orig) => ({ ...(await orig<typeof import('@/lib/sound')>()), playSound: vi.fn() }));
// Calls through to the real check; wrapped so a test can read the exact response the board sends.
vi.mock('@/lib/questions/check', async (orig) => {
  const m = await orig<typeof import('@/lib/questions/check')>();
  return { ...m, checkAnswer: vi.fn(m.checkAnswer) };
});

afterEach(cleanup);
beforeEach(() => vi.mocked(checkAnswer).mockClear());

type MP = Extract<NonWatchQuestion, { type: 'match_pairs' }>;
type MD = Extract<NonWatchDraft, { type: 'match_pairs' }>;
const pairs = [{ left: 'run', right: 'ran' }, { left: 'go', right: 'went' }, { left: 'eat', right: 'ate' }];
const mp = parseQuestion('match_pairs', { prompt: 'Match today with yesterday.', pairs }) as MP;

const tile = (side: 'left' | 'right', name: string) =>
  screen.getAllByRole('button', { name }).find((b) => b.getAttribute('data-side') === side)!;
const sideTexts = (side: 'left' | 'right') =>
  [...document.querySelectorAll(`button[data-side="${side}"]`)].map((b) => b.textContent);
const pair = (l: string, r: string) => { fireEvent.click(tile('left', l)); fireEvent.click(tile('right', r)); };
const check = () => screen.queryByRole('button', { name: 'Check' });

describe('match_pairs', () => {
  it('schema: 2 to 5 pairs, no repeated lefts or rights, the same text across sides is fine', () => {
    expect(mp).toEqual({ type: 'match_pairs', prompt: 'Match today with yesterday.', pairs });
    const p = (n: number) => Array.from({ length: n }, (_, i) => ({ left: `l${i}`, right: `r${i}` }));
    expect(() => parseQuestion('match_pairs', { prompt: 'p', pairs: p(1) })).toThrow();
    expect(() => parseQuestion('match_pairs', { prompt: 'p', pairs: p(2) })).not.toThrow();
    expect(() => parseQuestion('match_pairs', { prompt: 'p', pairs: p(5) })).not.toThrow();
    expect(() => parseQuestion('match_pairs', { prompt: 'p', pairs: p(6) })).toThrow();
    expect(() => parseQuestion('match_pairs', { prompt: 'p', pairs: [{ left: 'a', right: 'x' }, { left: 'a', right: 'y' }] })).toThrow(/is the same as left 1/);
    expect(() => parseQuestion('match_pairs', { prompt: 'p', pairs: [{ left: 'a', right: 'x' }, { left: 'b', right: ' x ' }] })).toThrow(/is the same as right 1/);
    expect(() => parseQuestion('match_pairs', { prompt: 'p', pairs: [{ left: 'a', right: 'b' }, { left: 'c', right: 'a' }] })).not.toThrow();
    expect(() => parseQuestion('match_pairs', { prompt: 'p', pairs: [{ left: 'a', right: '' }, { left: 'c', right: 'd' }] })).toThrow();
  });

  it('checkAnswer: only the identity pairing is right', () => {
    expect(checkAnswer(mp, { matches: [0, 1, 2] })).toBe(true);
    expect(checkAnswer(mp, { matches: [1, 0, 2] })).toBe(false);
    expect(checkAnswer(mp, { matches: [0, 1] })).toBe(false);
    expect(checkAnswer(mp, { matches: [0, 1, 2, 3] })).toBe(false);
    expect(checkAnswer(mp, { choice: 0 })).toBe(false);
  });

  it('component: lefts in pair order; rights never in the original order', () => {
    render(<MatchPairs q={mp} status="idle" onAnswer={vi.fn()} />);
    expect(sideTexts('left')).toEqual(['run', 'go', 'eat']);
    const rights = sideTexts('right');
    expect([...rights].sort()).toEqual(['ate', 'ran', 'went']);
    expect(rights).not.toEqual(['ran', 'went', 'ate']);
    cleanup();
    const two = parseQuestion('match_pairs', { prompt: 'p', pairs: [{ left: 'a', right: 'b' }, { left: 'c', right: 'd' }] }) as MP;
    render(<MatchPairs q={two} status="idle" onAnswer={vi.fn()} />);
    expect(sideTexts('right')).toEqual(['d', 'b']);
  });

  it('component: tap a left (pressed), then a right: both share a data-pair and a tint, with a connector', () => {
    render(<MatchPairs q={mp} status="idle" onAnswer={vi.fn()} />);
    fireEvent.click(tile('left', 'go'));
    expect(tile('left', 'go')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(tile('right', 'went'));
    expect(tile('left', 'go')).toHaveAttribute('aria-pressed', 'false');
    const k = tile('left', 'go').getAttribute('data-pair');
    expect(k).not.toBeNull();
    expect(tile('right', 'went')).toHaveAttribute('data-pair', k);
    expect(tile('left', 'go').style.background).toBe(tile('right', 'went').style.background);
    expect(tile('left', 'go').style.background).not.toBe('');
    expect(document.querySelectorAll(`[data-pair="${k}"]`)).toHaveLength(3);
    expect(document.querySelector(`span[data-pair="${k}"]`)).not.toBeNull();
    expect(tile('left', 'run')).not.toHaveAttribute('data-pair');
  });

  it('component: tapping a paired tile (either side) unpairs it', () => {
    render(<MatchPairs q={mp} status="idle" onAnswer={vi.fn()} />);
    pair('go', 'went');
    fireEvent.click(tile('left', 'go'));
    expect(tile('left', 'go')).not.toHaveAttribute('data-pair');
    expect(tile('right', 'went')).not.toHaveAttribute('data-pair');
    expect(document.querySelector('span[data-pair]')).toBeNull();
    pair('go', 'went');
    fireEvent.click(tile('right', 'went'));
    expect(tile('left', 'go')).not.toHaveAttribute('data-pair');
    expect(tile('right', 'went')).not.toHaveAttribute('data-pair');
  });

  it('component: Check shows only once every left has a match', () => {
    const onAnswer = vi.fn();
    render(<MatchPairs q={mp} status="idle" onAnswer={onAnswer} />);
    pair('run', 'ran');
    pair('go', 'went');
    expect(check()).toBeNull();
    pair('eat', 'ate');
    fireEvent.click(check()!);
    expect(onAnswer).toHaveBeenCalledWith(true);
    fireEvent.click(tile('left', 'eat'));
    expect(check()).toBeNull();
  });

  it('component: pairing is by position, not text (left "a" with the right tile "a" from pair 2 gives matches[0] === 1)', () => {
    const q = parseQuestion('match_pairs', { prompt: 'p', pairs: [{ left: 'a', right: 'b' }, { left: 'c', right: 'a' }] }) as MP;
    const onAnswer = vi.fn();
    render(<MatchPairs q={q} status="idle" onAnswer={onAnswer} />);
    pair('a', 'a');
    pair('c', 'b');
    fireEvent.click(check()!);
    expect(checkAnswer).toHaveBeenLastCalledWith(q, { matches: [1, 0] });
    expect(onAnswer).toHaveBeenLastCalledWith(false);
    fireEvent.click(tile('left', 'a'));
    fireEvent.click(tile('left', 'c'));
    pair('a', 'b');
    pair('c', 'a');
    fireEvent.click(check()!);
    expect(checkAnswer).toHaveBeenLastCalledWith(q, { matches: [0, 1] });
    expect(onAnswer).toHaveBeenLastCalledWith(true);
  });

  it('component: a miss marks only the off pairs (untinted); the right pair keeps its tint; Try again keeps the board', () => {
    const onAnswer = vi.fn();
    const { rerender } = render(<MatchPairs q={mp} status="idle" onAnswer={onAnswer} />);
    pair('run', 'ran');
    pair('go', 'ate');
    pair('eat', 'went');
    fireEvent.click(check()!);
    expect(onAnswer).toHaveBeenCalledWith(false);
    rerender(<MatchPairs q={mp} status="wrong" onAnswer={onAnswer} />);
    for (const [side, name] of [['left', 'go'], ['right', 'ate'], ['left', 'eat'], ['right', 'went']] as const) {
      expect(tile(side, name)).toHaveAttribute('data-mark', 'wrong');
      expect(tile(side, name).style.background).toBe('');
    }
    expect(tile('left', 'run')).not.toHaveAttribute('data-mark');
    expect(tile('right', 'ran')).not.toHaveAttribute('data-mark');
    expect(tile('left', 'run').style.background).not.toBe('');
    expect(check()).toBeNull();
    fireEvent.click(tile('left', 'go'));
    expect(tile('left', 'go')).toHaveAttribute('data-mark', 'wrong');
    rerender(<MatchPairs q={mp} status="idle" onAnswer={onAnswer} />);
    expect(tile('left', 'go')).toHaveAttribute('data-pair');
    expect(tile('left', 'go')).not.toHaveAttribute('data-mark');
    expect(check()).not.toBeNull();
    fireEvent.click(tile('right', 'ate'));
    expect(tile('left', 'go')).not.toHaveAttribute('data-pair');
  });

  it('component: right marks every tile right', () => {
    const { rerender } = render(<MatchPairs q={mp} status="idle" onAnswer={vi.fn()} />);
    pair('run', 'ran');
    pair('go', 'went');
    pair('eat', 'ate');
    rerender(<MatchPairs q={mp} status="right" onAnswer={vi.fn()} />);
    expect([...document.querySelectorAll('button[data-side]')].every((b) => b.getAttribute('data-mark') === 'right')).toBe(true);
    expect(tile('left', 'go').style.background).not.toBe('');
  });

  it('player: tag, prompt in the bubble, spoken order', () => {
    render(<QuestionPlayer questions={[{ id: 'q', question: mp }]} onAnswer={vi.fn()} onFinish={vi.fn()} blobColor="mint" stars={0} />);
    expect(screen.getByText('Match pairs')).toBeInTheDocument();
    expect(document.getElementById('q-ask')).toHaveTextContent('Match today with yesterday.');
    expect(spokenStrings(mp)).toEqual(['Match today with yesterday.', 'run', 'ran', 'go', 'went', 'eat', 'ate']);
  });

  it('player: a miss shows the hint, and Try again keeps the pairs', () => {
    render(<QuestionPlayer questions={[{ id: 'q', question: mp }]} onAnswer={vi.fn()} onFinish={vi.fn()} blobColor="mint" stars={0} />);
    pair('run', 'went');
    pair('go', 'ran');
    pair('eat', 'ate');
    fireEvent.click(check()!);
    expect(screen.getByText('Say each pair out loud.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(tile('left', 'run').getAttribute('data-pair')).toBe(tile('right', 'went').getAttribute('data-pair'));
    expect(tile('left', 'eat').getAttribute('data-pair')).toBe(tile('right', 'ate').getAttribute('data-pair'));
    expect(tile('left', 'run')).toHaveAttribute('data-pair');
    expect(check()).not.toBeNull();
  });

  it('tally: adds the number of pairs', () => {
    expect(tallyLines(addToTally({}, mp))).toEqual(['You made 3 pairs']);
    expect(tallyLines({ match_pairs: 1 })).toEqual(['You made 1 pair']);
  });

  it('draft round trip, empty draft, blank pairs dropped', () => {
    expect(draftFromQuestion(mp)).toEqual({ type: 'match_pairs', picture: '', prompt: 'Match today with yesterday.', pairs });
    expect(parseQuestion('match_pairs', draftToPayload(draftFromQuestion(mp)))).toEqual(mp);
    expect(emptyDraft('match_pairs')).toEqual({ type: 'match_pairs', picture: '', prompt: '', pairs: [{ left: '', right: '' }, { left: '', right: '' }] });
    const d: MD = { type: 'match_pairs', picture: '', prompt: ' p ', pairs: [{ left: ' a ', right: 'b' }, { left: ' ', right: '' }, { left: 'c', right: '' }] };
    expect(draftToPayload(d)).toEqual({ prompt: 'p', pairs: [{ left: 'a', right: 'b' }, { left: 'c', right: '' }] });
    expect(draftWords(d)).toBe(' p   a  b    c ');
    expect(TYPE_NAMES.match_pairs).toBe('Match pairs');
  });

  it('editor problems: readable per pair side', () => {
    expect(questionProblems('match_pairs', draftToPayload(emptyDraft('match_pairs')))).toEqual(['Prompt: fill this in.', 'Add at least 2 pairs.']);
    expect(questionProblems('match_pairs', { prompt: 'p', pairs: [{ left: 'a', right: 'b' }, { left: '', right: 'c' }] })).toEqual(['Pair 2, left: fill this in.']);
    expect(questionProblems('match_pairs', { prompt: 'p', pairs: [{ left: 'a', right: 'b' }, { left: 'c', right: 'd' }, { left: 'a', right: 'b' }] }))
      .toEqual(['Pair 3, left: is the same as left 1.', 'Pair 3, right: is the same as right 1.']);
    expect(questionProblems('watch_answer', { youtubeId: 'dQw4w9WgXcQ', questions: [{ type: 'match_pairs', prompt: 'p', pairs: [{ left: 'a', right: '' }, { left: 'c', right: 'd' }] }] }))
      .toEqual(['Question 1, Pair 1, right: fill this in.']);
  });

  it('editor form: Instruction, then a row of Left/Right per pair; remove off at 2, add off at 5', () => {
    const onChange = vi.fn();
    const d: MD = { type: 'match_pairs', picture: '', prompt: '', pairs: [{ left: 'run', right: 'ran' }, { left: 'go', right: '' }] };
    const { rerender } = render(<TypeForm draft={d} onChange={onChange} />);
    expect(screen.getByLabelText('Instruction')).toHaveAttribute('placeholder', 'Match today with yesterday.');
    expect(screen.getByRole('group', { name: 'Pairs' })).toBeInTheDocument();
    expect(screen.getByLabelText('Left 1')).toHaveValue('run');
    expect(screen.getByLabelText('Right 1')).toHaveValue('ran');
    expect(screen.getByLabelText('Left 2')).toHaveValue('go');
    expect(screen.getByRole('button', { name: 'Remove pair 1' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Right 2'), { target: { value: 'went' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...d, pairs: [d.pairs[0], { left: 'go', right: 'went' }] });
    fireEvent.click(screen.getByRole('button', { name: '+ Add a pair' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...d, pairs: [...d.pairs, { left: '', right: '' }] });
    const five: MD = { ...d, pairs: [...d.pairs, { left: 'x', right: 'y' }, { left: '', right: '' }, { left: '', right: '' }] };
    rerender(<TypeForm draft={five} onChange={onChange} />);
    expect(screen.getByRole('button', { name: '+ Add a pair' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove pair 3' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...five, pairs: [five.pairs[0], five.pairs[1], five.pairs[3], five.pairs[4]] });
  });

  it('answer summary: prompt, then each pair as left → right', () => {
    render(<QuestionAnswers question={mp} />);
    expect(screen.getByText('Match today with yesterday.')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['run → ran', 'go → went', 'eat → ate']);
  });

  it('sort it still tints its groups with the shared GROUP_TINTS', () => {
    expect(GROUP_TINTS).toEqual(['#B7E1D1', '#FFB5C1', '#A9D3FF', '#FFE59A']);
    const q = parseQuestion('sort_it', { prompt: 'p', groups: ['a', 'b'], items: [{ text: 'x', group: 0 }, { text: 'y', group: 1 }] }) as Extract<NonWatchQuestion, { type: 'sort_it' }>;
    render(<SortIt q={q} status="idle" onAnswer={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'a' }).style.background).toBe('rgb(183, 225, 209)');
    expect(screen.getByRole('button', { name: 'b' }).style.background).toBe('rgb(255, 181, 193)');
  });
});
