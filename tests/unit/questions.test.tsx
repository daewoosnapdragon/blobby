import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NonWatchQuestion, Question } from '@/lib/questions/schema';
import { checkAnswer } from '@/lib/questions/check';
import { PickOne } from '@/components/questions/PickOne';
import { ListenTap } from '@/components/questions/ListenTap';
import { FillBlank } from '@/components/questions/FillBlank';
import { FindFix } from '@/components/questions/FindFix';
import { BuildIt } from '@/components/questions/BuildIt';
import { SortIt } from '@/components/questions/SortIt';
import { spokenStrings } from '@/lib/spoken';
import { QuestionPlayer } from '@/components/questions/QuestionPlayer';
import { HearIt } from '@/components/ui/HearIt';
import { ALMOST_LINES, RIGHT_LINES, ROLL3_LINES } from '@/lib/feedbackLines';

vi.mock('@/lib/sound', async (orig) => ({ ...(await orig<typeof import('@/lib/sound')>()), playSound: vi.fn() }));
import { playSound } from '@/lib/sound';

type Q<T extends NonWatchQuestion['type']> = Extract<NonWatchQuestion, { type: T }>;

const pick: Q<'pick_one'> = {
  type: 'pick_one',
  prompt: 'Which sentence is right?',
  choices: ['She don’t like carrots.', 'She doesn’t like carrots.', 'She doesn’t likes carrots.'],
  answer: 1,
};
const listen: Q<'listen_tap'> = {
  type: 'listen_tap',
  prompt: 'Tap the word you hear.',
  audioText: 'bee',
  choices: [{ text: 'tree' }, { text: 'bee' }, { text: 'see' }],
  answer: 1,
};
const blank: Q<'fill_blank'> = {
  type: 'fill_blank',
  before: 'Yesterday, we',
  after: 'pizza for lunch.',
  choices: ['eat', 'ate', 'eating'],
  answer: 1,
};
const fix: Q<'find_fix'> = {
  type: 'find_fix',
  words: ['She', 'goed', 'to', 'the', 'park.'],
  wrongIndex: 1,
  fixes: ['went', 'gone', 'going'],
  answer: 0,
};
const build: Q<'build_it'> = {
  type: 'build_it',
  prompt: 'Build the sentence.',
  tiles: ['We', 'played', 'soccer'],
  distractors: ['play'],
};
const sort: Q<'sort_it'> = {
  type: 'sort_it',
  prompt: 'Nouns and verbs',
  groups: ['Noun', 'Verb'],
  items: [{ text: 'cat', group: 0 }, { text: 'run', group: 1 }],
};

const btn = (name: string | RegExp) => screen.getByRole('button', { name });

describe('each question component calls onAnswer with the checkAnswer result', () => {
  it('PickOne: right and wrong', () => {
    const onAnswer = vi.fn();
    const { rerender } = render(<PickOne q={pick} status="idle" onAnswer={onAnswer} />);
    fireEvent.click(btn('She doesn’t like carrots.'));
    expect(onAnswer).toHaveBeenLastCalledWith(checkAnswer(pick, { choice: 1 }));
    expect(onAnswer).toHaveBeenLastCalledWith(true);
    rerender(<PickOne q={pick} status="idle" onAnswer={onAnswer} />);
    fireEvent.click(btn('She don’t like carrots.'));
    expect(onAnswer).toHaveBeenLastCalledWith(false);
  });

  it('PickOne ignores taps while feedback is showing', () => {
    const onAnswer = vi.fn();
    render(<PickOne q={pick} status="wrong" onAnswer={onAnswer} />);
    fireEvent.click(btn('She doesn’t like carrots.'));
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('ListenTap', () => {
    const onAnswer = vi.fn();
    render(<ListenTap q={listen} status="idle" onAnswer={onAnswer} />);
    fireEvent.click(btn('see'));
    expect(onAnswer).toHaveBeenLastCalledWith(checkAnswer(listen, { choice: 2 }));
    fireEvent.click(btn('bee'));
    expect(onAnswer).toHaveBeenLastCalledWith(true);
  });

  it('FillBlank shows the sentence around the blank, and checks the choice', () => {
    const onAnswer = vi.fn();
    render(<FillBlank q={blank} status="idle" onAnswer={onAnswer} />);
    expect(screen.getByText(/Yesterday, we/)).toBeInTheDocument();
    expect(screen.getByText(/pizza for lunch\./)).toBeInTheDocument();
    fireEvent.click(btn('eat'));
    expect(onAnswer).toHaveBeenLastCalledWith(false);
    fireEvent.click(btn('ate'));
    expect(onAnswer).toHaveBeenLastCalledWith(checkAnswer(blank, { choice: 1 }));
    expect(onAnswer).toHaveBeenLastCalledWith(true);
  });

  it('FindFix shows the fixes only after the wrong word is tapped', () => {
    const onAnswer = vi.fn();
    render(<FindFix q={fix} status="idle" onAnswer={onAnswer} />);
    expect(screen.queryByRole('button', { name: 'went' })).toBeNull();
    fireEvent.click(btn('goed'));
    expect(onAnswer).not.toHaveBeenCalled();
    expect(btn('went')).toBeInTheDocument();
    expect(btn('gone')).toBeInTheDocument();
    fireEvent.click(btn('went'));
    expect(onAnswer).toHaveBeenLastCalledWith(checkAnswer(fix, { tapped: 1, fix: 0 }));
    expect(onAnswer).toHaveBeenLastCalledWith(true);
  });

  it('FindFix: a wrong fix, or tapping a word that is fine, is a wrong answer', () => {
    const onAnswer = vi.fn();
    const { rerender } = render(<FindFix q={fix} status="idle" onAnswer={onAnswer} />);
    fireEvent.click(btn('goed'));
    fireEvent.click(btn('gone'));
    expect(onAnswer).toHaveBeenLastCalledWith(false);
    rerender(<FindFix key="fresh" q={fix} status="idle" onAnswer={onAnswer} />);
    fireEvent.click(btn('park.'));
    expect(onAnswer).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('button', { name: 'went' })).toBeNull();
  });

  it('BuildIt: tiles move to the answer row and back, and Check calls onAnswer', () => {
    const onAnswer = vi.fn();
    render(<BuildIt q={build} status="idle" onAnswer={onAnswer} />);
    const bank = screen.getByRole('group', { name: 'Word tiles' });
    const row = screen.getByRole('group', { name: 'Your sentence' });
    expect(within(bank).getAllByRole('button')).toHaveLength(4); // 3 tiles + 1 distractor

    fireEvent.click(within(bank).getByRole('button', { name: 'soccer' }));
    expect(within(row).getByRole('button', { name: 'soccer' })).toBeInTheDocument();
    expect(within(bank).queryByRole('button', { name: 'soccer' })).toBeNull();

    // tapped in the answer row: it moves back to the bank
    fireEvent.click(within(row).getByRole('button', { name: 'soccer' }));
    expect(within(row).queryByRole('button', { name: 'soccer' })).toBeNull();
    expect(within(bank).getByRole('button', { name: 'soccer' })).toBeInTheDocument();

    for (const w of ['We', 'played', 'soccer']) fireEvent.click(within(bank).getByRole('button', { name: w }));
    fireEvent.click(btn('Check'));
    expect(onAnswer).toHaveBeenLastCalledWith(checkAnswer(build, { order: ['We', 'played', 'soccer'] }));
    expect(onAnswer).toHaveBeenLastCalledWith(true);
  });

  it('BuildIt: a wrong order is wrong', () => {
    const onAnswer = vi.fn();
    render(<BuildIt q={build} status="idle" onAnswer={onAnswer} />);
    const bank = screen.getByRole('group', { name: 'Word tiles' });
    for (const w of ['We', 'play', 'soccer']) fireEvent.click(within(bank).getByRole('button', { name: w }));
    fireEvent.click(btn('Check'));
    expect(onAnswer).toHaveBeenLastCalledWith(false);
  });

  it('SortIt: pick a word, then a group; Check calls onAnswer', () => {
    const onAnswer = vi.fn();
    const { rerender } = render(<SortIt q={sort} status="idle" onAnswer={onAnswer} />);
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
    fireEvent.click(btn('cat'));
    expect(btn('cat')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(btn('Verb'));
    fireEvent.click(btn('run'));
    fireEvent.click(btn('Noun'));
    fireEvent.click(btn('Check'));
    expect(onAnswer).toHaveBeenLastCalledWith(checkAnswer(sort, { placement: [1, 0] }));
    expect(onAnswer).toHaveBeenLastCalledWith(false);

    rerender(<SortIt key="again" q={sort} status="idle" onAnswer={onAnswer} />);
    fireEvent.click(btn('cat'));
    fireEvent.click(btn('Noun'));
    fireEvent.click(btn('run'));
    fireEvent.click(btn('Verb'));
    fireEvent.click(btn('Check'));
    expect(onAnswer).toHaveBeenLastCalledWith(true);
  });

  it('SortIt: a placed word tapped again goes back to the word bank', () => {
    const onAnswer = vi.fn();
    render(<SortIt q={sort} status="idle" onAnswer={onAnswer} />);
    fireEvent.click(btn('cat'));
    fireEvent.click(btn('Noun'));
    const noun = screen.getByRole('group', { name: 'Noun' });
    fireEvent.click(within(noun).getByRole('button', { name: 'cat' }));
    expect(within(noun).queryByRole('button', { name: 'cat' })).toBeNull();
    expect(within(screen.getByRole('group', { name: 'Words to sort' })).getByRole('button', { name: 'cat' })).toBeInTheDocument();
  });
});

// ---- audio --------------------------------------------------------------------------------

type PlayMode = 'error' | 'ok' | 'blocked';
let mode: PlayMode = 'ok';
let played: string[] = [];

beforeEach(() => {
  mode = 'ok';
  played = [];
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    played.push(this.src);
    if (mode === 'blocked') return Promise.reject(new DOMException('no gesture', 'NotAllowedError'));
    const el = this;
    setTimeout(() => el.dispatchEvent(new Event(mode === 'error' ? 'error' : 'ended')), 0);
    return Promise.resolve();
  });
});
afterEach(() => vi.restoreAllMocks());

const flush = () => act(() => new Promise((r) => setTimeout(r, 5)));

describe('HearIt', () => {
  it('plays each text in order, then is ready again', async () => {
    render(<HearIt texts={['one', 'two']} audio={{ one: 'http://a/1.mp3', two: 'http://a/2.mp3' }} />);
    fireEvent.click(btn('Hear it'));
    await flush();
    await flush();
    expect(played).toEqual(['http://a/1.mp3', 'http://a/2.mp3']);
    expect(btn('Hear it')).toBeInTheDocument();
  });

  it('an audio URL that errors shows "Try again"; tapping it tries again', async () => {
    mode = 'error';
    render(<HearIt texts={['one']} audio={{ one: 'http://a/broken.mp3' }} />);
    fireEvent.click(btn('Hear it'));
    await flush();
    expect(btn('Try again to hear it')).toHaveTextContent('Try again');
    mode = 'ok';
    fireEvent.click(btn('Try again to hear it'));
    await flush();
    expect(btn('Hear it')).toBeInTheDocument();
    expect(played).toHaveLength(2);
  });

  it('a missing URL shows "Try again"', async () => {
    render(<HearIt texts={['one']} audio={{}} />);
    fireEvent.click(btn('Hear it'));
    await flush();
    expect(btn('Try again to hear it')).toBeInTheDocument();
  });

  it('autoPlay that the browser blocks fails silently', async () => {
    mode = 'blocked';
    render(<HearIt texts={['one']} audio={{ one: 'http://a/1.mp3' }} autoPlay />);
    await flush();
    expect(played).toEqual(['http://a/1.mp3']);
    expect(btn('Hear it')).toBeInTheDocument();
  });
});

// ---- the player ---------------------------------------------------------------------------

const pq = (id: string, question: Question, audio: Record<string, string> = {}) => ({ id, question, audio });
const QID = '00000000-0000-4000-8000-0000000000a1';
const QID2 = '00000000-0000-4000-8000-0000000000a2';

function renderPlayer(props: Partial<Parameters<typeof QuestionPlayer>[0]> = {}) {
  const onAnswer = vi.fn();
  const onFinish = vi.fn();
  render(
    <QuestionPlayer
      questions={[pq(QID, pick), pq(QID2, listen)]}
      onAnswer={onAnswer}
      onFinish={onFinish}
      blobColor="mint"
      stars={42}
      {...props}
    />,
  );
  return { onAnswer, onFinish };
}

describe('QuestionPlayer sounds', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.mocked(playSound).mockClear(); });
  afterEach(() => vi.useRealTimers());

  it('pops on an answer tap, then dings when right or boops when wrong', () => {
    renderPlayer();
    fireEvent.click(btn('She don’t like carrots.'));
    expect(playSound).toHaveBeenCalledWith('pop');
    act(() => { vi.advanceTimersByTime(100); });
    expect(playSound).toHaveBeenLastCalledWith('boop');
    fireEvent.click(btn('Try again'));
    fireEvent.click(btn('She doesn’t like carrots.'));
    act(() => { vi.advanceTimersByTime(100); });
    expect(playSound).toHaveBeenLastCalledWith('ding', { rate: 1 });
  });

  it('does not pop for Hear it, so read-aloud is not covered', () => {
    // Hear it only shows for a question with audio
    const audio = Object.fromEntries(spokenStrings(pick).map((t) => [t, 'http://a/1.mp3']));
    renderPlayer({ questions: [pq(QID, pick, audio), pq(QID2, listen)] });
    vi.mocked(playSound).mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Hear it' }));
    expect(playSound).not.toHaveBeenCalled();
  });
});

describe('QuestionPlayer', () => {
  it('records only the first try, shows words with the feedback, and finishes after the last Next', () => {
    const { onAnswer, onFinish } = renderPlayer();
    expect(screen.getByRole('progressbar', { name: 'Question 1 of 2' })).toBeInTheDocument();
    expect(screen.getByLabelText('42 stars')).toBeInTheDocument();

    fireEvent.click(btn('She don’t like carrots.'));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenLastCalledWith({ id: QID, question: pick }, false);
    const status = screen.getByRole('status');
    expect(status.querySelector('[data-result="wrong"]')).not.toBeNull();
    expect(within(status).getByText(/./, { selector: '[data-hint]' })).toBeInTheDocument();

    fireEvent.click(btn('Try again'));
    expect(screen.getByRole('status').querySelector('[data-result="wrong"]')).toBeNull();
    fireEvent.click(btn('She doesn’t like carrots.'));
    expect(onAnswer).toHaveBeenCalledTimes(1); // the retry is not recorded
    expect(screen.getByRole('status').querySelector('[data-result="right"]')).not.toBeNull();
    expect(screen.queryByText(/\+1 star/)).toBeNull(); // lessons show no per-answer star

    fireEvent.click(btn('Next'));
    expect(screen.getByRole('progressbar', { name: 'Question 2 of 2' })).toBeInTheDocument();
    fireEvent.click(btn('bee'));
    expect(onAnswer).toHaveBeenCalledTimes(2);
    expect(onAnswer).toHaveBeenLastCalledWith({ id: QID2, question: listen }, true);
    expect(onFinish).not.toHaveBeenCalled();
    fireEvent.click(btn('Next'));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('shows "+1 star" on a first-try right answer when answerStars is set (free practice)', () => {
    renderPlayer({ answerStars: 1 });
    fireEvent.click(btn('She doesn’t like carrots.'));
    expect(screen.getByRole('status')).toHaveTextContent('+1 star');
  });

  it('expands watch_answer into its inner questions, recorded under the parent id', () => {
    const watch: Question = { type: 'watch_answer', youtubeId: 'dQw4w9WgXcQ', questions: [pick, fix] };
    const { onAnswer } = renderPlayer({ questions: [pq(QID, watch)] });
    expect(btn('Next')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Watch the video, then 2 questions' })).toBeInTheDocument();
    fireEvent.click(btn('Next')); // the video step comes first
    expect(screen.getByRole('progressbar', { name: 'Question 1 of 2' })).toBeInTheDocument();
    fireEvent.click(btn('She doesn’t like carrots.'));
    expect(onAnswer).toHaveBeenLastCalledWith({ id: QID, question: pick }, true);
    fireEvent.click(btn('Next'));
    fireEvent.click(btn('goed'));
    fireEvent.click(btn('went'));
    expect(onAnswer).toHaveBeenLastCalledWith({ id: QID, question: fix }, true);
  });

  it('Review Focus #5: when the audio fails, Hear it says "Try again" and the question is still answerable', async () => {
    mode = 'error';
    const { onAnswer } = renderPlayer({ questions: [pq(QID, pick, { [pick.prompt]: 'http://a/broken.mp3' })] });
    fireEvent.click(btn('Hear it'));
    await flush();
    expect(btn('Try again to hear it')).toBeInTheDocument();
    fireEvent.click(btn('She doesn’t like carrots.'));
    expect(onAnswer).toHaveBeenLastCalledWith({ id: QID, question: pick }, true);
    expect(screen.getByRole('status').querySelector('[data-result="right"]')).not.toBeNull();
  });

  it('autoRead (Grades 1–2) plays the prompt when a question appears; otherwise it waits for a tap', async () => {
    renderPlayer({ questions: [pq(QID, pick, { [pick.prompt]: 'http://a/p.mp3' })], autoRead: true });
    await flush();
    expect(played).toEqual(['http://a/p.mp3']);
  });

  it('does not auto-play without autoRead', async () => {
    renderPlayer({ questions: [pq(QID, pick, { [pick.prompt]: 'http://a/p.mp3' })] });
    await flush();
    expect(played).toEqual([]);
  });
});

describe('focus and announcements (Task 8b review minors)', () => {
  it('after Try again, focus moves to the question prompt', () => {
    renderPlayer();
    fireEvent.click(btn('She don’t like carrots.'));
    fireEvent.click(btn('Try again'));
    expect(document.activeElement).toBe(document.getElementById('q-ask'));
    expect(document.activeElement).toHaveTextContent('Which sentence is right?');
  });

  it('after Next, focus moves to the new question’s prompt', () => {
    renderPlayer();
    fireEvent.click(btn('She doesn’t like carrots.'));
    fireEvent.click(btn('Next'));
    expect(document.activeElement).toBe(document.getElementById('q-ask'));
    expect(document.activeElement).toHaveTextContent('Tap the word you hear.');
  });

  it('HearIt failing is announced in a live region', async () => {
    mode = 'error';
    const { container } = render(<HearIt texts={['one']} audio={{ one: 'http://a/broken.mp3' }} />);
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live).toHaveTextContent('');
    fireEvent.click(btn('Hear it'));
    await flush();
    expect(live).toHaveTextContent(/couldn.t play/i);
  });
});

// ---- player feel: bonus, roll, lines, tally ------------------------------------------------

describe('QuestionPlayer feel', () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-0000000000b${i}`);
  const reactionNow = () => document.querySelector('[data-reaction]')?.getAttribute('data-reaction') ?? null;
  const title = () => screen.getByRole('status').querySelector('[data-result]')!.firstElementChild!.firstElementChild!.textContent;
  const askText = () => document.getElementById('q-ask')!.textContent;

  it('bonus: tag, bubble prefix on fill_blank, +2 note on a first-try right, and no tag in bare mode', () => {
    renderPlayer({ questions: [{ ...pq(QID, blank), bonus: true }], answerStars: 1, bonusStars: 2 });
    expect(screen.getByText('Bonus!')).toBeInTheDocument();
    expect(askText()).toBe('Bonus! Which word fits?');
    fireEvent.click(btn('ate'));
    expect(screen.getByRole('status')).toHaveTextContent('+2 stars');
    cleanup();

    const { onFinish } = renderPlayer({ questions: [{ ...pq(QID, blank), bonus: true }], bonusStars: 2, bare: true });
    expect(screen.queryByText('Bonus!')).toBeNull();
    fireEvent.click(btn('ate'));
    fireEvent.click(btn('Next'));
    expect(onFinish).toHaveBeenCalledWith({});
  });

  it('a bonus pick_one keeps its prompt as the bubble', () => {
    renderPlayer({ questions: [{ ...pq(QID, pick), bonus: true }], bonusStars: 2 });
    expect(askText()).toBe(pick.prompt);
  });

  describe('with fake timers', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.mocked(playSound).mockClear(); });
    afterEach(() => vi.useRealTimers());

    it('roll: hop, hop, cheer with sparkles at 3, spin at 5; a wrong first try resets to hop and rate 1', () => {
      renderPlayer({ questions: ids(6).map((id) => pq(id, pick)), answerStars: 1 });
      const want: [number, string, boolean][] = [[1, 'hop', false], [1.06, 'hop', false], [1.12, 'cheer', true], [1.19, 'hop', false], [1.26, 'spin', true]];
      for (const [rate, kind, sparkles] of want) {
        fireEvent.click(btn('She doesn’t like carrots.'));
        act(() => { vi.advanceTimersByTime(100); });
        expect(playSound).toHaveBeenLastCalledWith('ding', { rate });
        expect(reactionNow()).toBe(kind);
        expect(screen.queryByTestId('sparkles') !== null).toBe(sparkles);
        fireEvent.click(btn('Next'));
      }
      fireEvent.click(btn('She don’t like carrots.'));
      act(() => { vi.advanceTimersByTime(100); });
      expect(playSound).toHaveBeenLastCalledWith('boop');
      expect(reactionNow()).toBe('wobble');
      expect(screen.queryByTestId('sparkles')).toBeNull();
      expect(screen.getByRole('status')).not.toHaveTextContent(/streak/i);
      fireEvent.click(btn('Try again'));
      fireEvent.click(btn('She doesn’t like carrots.'));
      act(() => { vi.advanceTimersByTime(100); });
      expect(playSound).toHaveBeenLastCalledWith('ding', { rate: 1 });
      expect(reactionNow()).toBe('hop');
      expect(screen.queryByText(/\+1 star/)).toBeNull();
    });
  });

  it('titles come from the pools and never repeat back to back', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // every pick lands on the pool's first line unless it repeats
    renderPlayer({ questions: ids(5).map((id) => pq(id, pick)) });
    const seen: [string | null, readonly string[]][] = [];
    for (let i = 0; i < 3; i++) {
      fireEvent.click(btn('She don’t like carrots.'));
      seen.push([title(), ALMOST_LINES]);
      fireEvent.click(btn('Try again'));
    }
    fireEvent.click(btn('She doesn’t like carrots.'));
    seen.push([title(), RIGHT_LINES]); // roll 0: the first try missed
    fireEvent.click(btn('Next'));
    for (const pool of [RIGHT_LINES, RIGHT_LINES, ROLL3_LINES, RIGHT_LINES]) {
      fireEvent.click(btn('She doesn’t like carrots.'));
      seen.push([title(), pool]);
      fireEvent.click(btn('Next'));
    }
    seen.forEach(([t, pool], i) => {
      expect(pool).toContain(t);
      if (i > 0) expect(t).not.toBe(seen[i - 1][0]);
    });
  });

  it('the bubble names the answer for fill_blank and find_fix; others get a right line, a miss an almost line', () => {
    renderPlayer({ questions: [pq(QID, blank), pq(QID2, fix), pq(ids(1)[0], pick)] });
    fireEvent.click(btn('ate'));
    expect(askText()).toBe('“ate” fits!');
    fireEvent.click(btn('Next'));
    fireEvent.click(btn('goed'));
    fireEvent.click(btn('went'));
    expect(askText()).toBe('went, not goed!');
    fireEvent.click(btn('Next'));
    fireEvent.click(btn('She don’t like carrots.'));
    expect(ALMOST_LINES).toContain(askText());
    fireEvent.click(btn('Try again'));
    fireEvent.click(btn('She doesn’t like carrots.'));
    expect(RIGHT_LINES).toContain(askText());
  });

  it('onFinish receives the tally', () => {
    const sort3: Q<'sort_it'> = { ...sort, items: [...sort.items, { text: 'dog', group: 0 }] };
    const { onFinish } = renderPlayer({ questions: [pq(QID, pick), pq(QID2, pick), pq(ids(1)[0], sort3)] });
    fireEvent.click(btn('She doesn’t like carrots.'));
    fireEvent.click(btn('Next'));
    fireEvent.click(btn('She doesn’t like carrots.'));
    fireEvent.click(btn('Next'));
    for (const [w, g] of [['cat', 'Noun'], ['run', 'Verb'], ['dog', 'Noun']]) {
      fireEvent.click(btn(w));
      fireEvent.click(btn(g));
    }
    fireEvent.click(btn('Check'));
    fireEvent.click(btn('Next'));
    expect(onFinish).toHaveBeenCalledWith({ pick_one: 2, sort_it: 3 });
  });
});
