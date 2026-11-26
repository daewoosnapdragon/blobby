import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NonWatchQuestion, Question } from '@/lib/questions/schema';
import { QuestionPlayer } from '@/components/questions/QuestionPlayer';
import { WatchAnswer } from '@/components/questions/WatchAnswer';

vi.mock('@/lib/sound', async (orig) => ({ ...(await orig<typeof import('@/lib/sound')>()), playSound: vi.fn() }));
const markActive = vi.hoisted(() => vi.fn());
vi.mock('@/components/usePracticePing', async (orig) => ({ ...(await orig<typeof import('@/components/usePracticePing')>()), markActive }));

const ID = 'dQw4w9WgXcQ';
const pick: NonWatchQuestion = {
  type: 'pick_one', prompt: 'Which sentence is right?',
  choices: ['She don’t like carrots.', 'She doesn’t like carrots.', 'She doesn’t likes carrots.'], answer: 1,
};
const watch: Question = { type: 'watch_answer', youtubeId: ID, questions: [pick] };
const btn = (n: string) => screen.getByRole('button', { name: n });

function renderPlayer() {
  const onAnswer = vi.fn();
  const onFinish = vi.fn();
  render(<QuestionPlayer questions={[{ id: 'q1', question: watch }]} onAnswer={onAnswer} onFinish={onFinish} blobColor="mint" stars={0} />);
  return { onAnswer, onFinish };
}
const iframe = () => document.querySelector('iframe') as HTMLIFrameElement;
function fromPlayer(data: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data: JSON.stringify(data), origin: 'https://www.youtube-nocookie.com', source: iframe().contentWindow,
    }));
  });
}

let online = true;
beforeEach(() => {
  vi.useFakeTimers();
  markActive.mockClear();
  online = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('watch and answer', () => {
  it('shows the video first, with the nocookie embed, a title, and no Hear it', () => {
    renderPlayer();
    expect(iframe().src).toBe(`https://www.youtube-nocookie.com/embed/${ID}?rel=0&modestbranding=1&enablejsapi=1&playsinline=1`);
    expect(iframe().title).not.toBe('');
    expect(screen.queryByRole('button', { name: /hear it/i })).toBeNull();
    expect(screen.queryByText('Which sentence is right?')).toBeNull();
  });

  it('has a visible caption and a progress label that makes sense before the questions start', () => {
    renderPlayer();
    expect(screen.getByText('Watch the video')).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Watch the video, then 1 question' })).toBeInTheDocument();
    fireEvent.click(btn('Next'));
    expect(screen.getByRole('progressbar', { name: 'Question 1 of 1' })).toBeInTheDocument();
  });

  it('Next is always there and moves on to the questions; progress counts the questions', () => {
    const { onAnswer } = renderPlayer();
    fireEvent.click(btn('Next'));
    expect(screen.getByRole('progressbar', { name: 'Question 1 of 1' })).toBeInTheDocument();
    fireEvent.click(btn('She doesn’t like carrots.'));
    expect(onAnswer).toHaveBeenCalledWith({ id: 'q1', question: pick }, true);
  });

  it('Review Focus #5: if the player never loads, Skip video appears after 8s and the questions stay playable', () => {
    const { onAnswer } = renderPlayer();
    expect(screen.queryByRole('button', { name: 'Skip video' })).toBeNull();
    act(() => { vi.advanceTimersByTime(7_900); });
    expect(screen.queryByRole('button', { name: 'Skip video' })).toBeNull();
    act(() => { vi.advanceTimersByTime(200); });
    expect(btn('Next')).toBeInTheDocument();
    fireEvent.click(btn('Skip video'));
    fireEvent.click(btn('She doesn’t like carrots.'));
    expect(onAnswer).toHaveBeenLastCalledWith({ id: 'q1', question: pick }, true);
    expect(screen.getByRole('status').querySelector('[data-result="right"]')).not.toBeNull();
  });

  it('a load event alone (could be a browser error page) does not stop the 8s check', () => {
    renderPlayer();
    fireEvent.load(iframe());
    act(() => { vi.advanceTimersByTime(8_100); });
    expect(btn('Skip video')).toBeInTheDocument();
  });

  it('no Skip video once the player has talked to us', () => {
    renderPlayer();
    fireEvent.load(iframe());
    fromPlayer({ event: 'onReady' });
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(screen.queryByRole('button', { name: 'Skip video' })).toBeNull();
  });

  it('a player error event shows Skip video at once', () => {
    renderPlayer();
    fireEvent.load(iframe());
    fromPlayer({ event: 'onError', info: 150 });
    expect(btn('Skip video')).toBeInTheDocument();
  });

  it('offline shows Skip video at once', () => {
    online = false;
    renderPlayer();
    expect(btn('Skip video')).toBeInTheDocument();
  });

  it('going offline later shows Skip video', () => {
    renderPlayer();
    fireEvent.load(iframe());
    online = false;
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(btn('Skip video')).toBeInTheDocument();
  });

  it('counts watching as practice only while the player is playing', () => {
    renderPlayer();
    fireEvent.load(iframe());
    fromPlayer({ event: 'onStateChange', info: 2 }); // paused
    fromPlayer({ event: 'infoDelivery', info: { currentTime: 3 } });
    expect(markActive).not.toHaveBeenCalled();
    fromPlayer({ event: 'onStateChange', info: 1 }); // playing
    expect(markActive).toHaveBeenCalled();
    markActive.mockClear();
    fromPlayer({ event: 'infoDelivery', info: { currentTime: 4, playerState: 1 } });
    expect(markActive).toHaveBeenCalled();
    markActive.mockClear();
    fromPlayer({ event: 'infoDelivery', info: { playerState: 2 } });
    fromPlayer({ event: 'infoDelivery', info: { currentTime: 5 } });
    expect(markActive).not.toHaveBeenCalled();
  });

  it('ignores messages from other windows or origins', () => {
    renderPlayer();
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ event: 'onStateChange', info: 1 }), origin: 'https://evil.example', source: iframe().contentWindow }));
      window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ event: 'onStateChange', info: 1 }), origin: 'https://www.youtube-nocookie.com', source: window }));
    });
    expect(markActive).not.toHaveBeenCalled();
  });

  it('WatchAnswer on its own: Next calls onDone', () => {
    const onDone = vi.fn();
    render(<WatchAnswer youtubeId={ID} onDone={onDone} />);
    fireEvent.click(btn('Next'));
    expect(onDone).toHaveBeenCalled();
  });
});
