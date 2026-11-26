'use client';
import { useState } from 'react';
import { checkAnswer } from '@/lib/questions/check';
import { MarkIcon } from './Marks';
import type { QProps } from './types';
import s from './questions.module.css';

/** Odd one out: three or four words, the kid taps the one that doesn't belong. */
export function OddOneOut({ q, status, onAnswer }: QProps<'odd_one_out'>) {
  const [picked, setPicked] = useState<number | null>(null);
  const locked = status !== 'idle';
  function choose(i: number) {
    if (locked) return;
    setPicked(i);
    onAnswer(checkAnswer(q, { choice: i }));
  }
  return (
    <div className={s.wordGrid} data-count={q.words.length}>
      {q.words.map((w, i) => {
        const mark = locked && picked === i ? status : undefined;
        return (
          <button key={i} type="button" className={s.word} data-mark={mark} aria-disabled={locked || undefined} onClick={() => choose(i)}>
            <span>{w}</span>
            {mark ? <span className={s.cornerMark} aria-hidden="true"><MarkIcon mark={mark} /></span> : null}
          </button>
        );
      })}
    </div>
  );
}
