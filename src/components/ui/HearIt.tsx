'use client';
import { useEffect, useRef, useState } from 'react';
import { RetryIcon, SpeakerIcon } from './icons';
import styles from './ui.module.css';

type Props = {
  /** the spoken strings, in play order; each is a key of `audio` */
  texts: string[];
  /** spoken text -> pre-generated audio URL (questions.audio) */
  audio: Record<string, string>;
  /** play on mount (Grades 1–2). A blocked or failed autoplay stays silent: the kid didn't ask. */
  autoPlay?: boolean;
  /** what autoplay reads; defaults to `texts` */
  autoPlayTexts?: string[];
};

type State = 'idle' | 'playing' | 'error';

/**
 * "Hear it" (spec 5.7). Plays each URL in turn. A missing URL or an audio error shows "Try again";
 * nothing about the question depends on this button (Review Focus #5).
 */
export function HearIt({ texts, audio, autoPlay = false, autoPlayTexts }: Props) {
  const [state, setState] = useState<State>('idle');
  const run = useRef(0);
  const el = useRef<HTMLAudioElement | null>(null);

  function stop() {
    run.current++;
    el.current?.pause();
    el.current = null;
  }

  function playOne(url: string, my: number) {
    return new Promise<void>((resolve, reject) => {
      const a = new Audio(url);
      el.current = a;
      a.addEventListener('ended', () => resolve(), { once: true });
      a.addEventListener('error', () => reject(new Error('audio error')), { once: true });
      try {
        const p = a.play();
        if (p && typeof p.catch === 'function') p.catch(reject);
      } catch (e) {
        reject(e);
      }
      if (run.current !== my) resolve();
    });
  }

  async function play(list: string[], silent: boolean) {
    stop();
    const my = run.current;
    setState('playing');
    try {
      for (const t of list) {
        const url = audio[t.trim()];
        if (!url) throw new Error('no audio');
        await playOne(url, my);
        if (run.current !== my) return;
      }
      setState('idle');
    } catch {
      if (run.current !== my) return;
      el.current = null;
      setState(silent ? 'idle' : 'error');
    }
  }

  useEffect(() => {
    if (autoPlay) void play(autoPlayTexts ?? texts, true);
    return stop;
    // mount-only: each question mounts its own HearIt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const error = state === 'error';
  return (
    <>
    <button
      type="button"
      className={`${styles.hear} ${state === 'playing' ? styles.hearPlaying : ''}`}
      onClick={() => void play(texts, false)}
      aria-label={error ? 'Try again to hear it' : 'Hear it'}
      data-state={state}
    >
      {error ? <RetryIcon /> : <SpeakerIcon />}
      {error ? 'Try again' : 'Hear it'}
    </button>
    {/* A name change on a focused button isn't reliably announced; this is. */}
    <span className="sr-only" aria-live="polite">{error ? 'Couldn’t play the sound. Tap Try again to hear it.' : ''}</span>
    </>
  );
}
