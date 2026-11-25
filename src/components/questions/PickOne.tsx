'use client';
import { useState } from 'react';
import { checkAnswer } from '@/lib/questions/check';
import { MarkIcon } from './Marks';
import type { QProps } from './types';
import s from './questions.module.css';

const LETTERS = ['A', 'B', 'C', 'D'];

/** Pick the right one: 2–4 sentences, one is right (D-Question). */
export function PickOne({ q, status, onAnswer }: QProps<'pick_one'>) {
  const [picked, setPicked] = useState<number | null>(null);
  const locked = status !== 'idle';
  function choose(i: number) {
    if (locked) return;
    setPicked(i);
    onAnswer(checkAnswer(q, { choice: i }));
  }
  return (
    // Short choices (words) can sit two to a row on wide screens; sentences stay one per row for easy comparing.
    <div className={s.options} data-short={q.choices.every((c) => c.length <= 18) ? '' : undefined}>
      {q.choices.map((c, i) => {
        const mark = locked && picked === i ? status : undefined;
        return (
          <button key={i} type="button" className={s.option} data-mark={mark} aria-disabled={locked || undefined} onClick={() => choose(i)}>
            <span className={s.letter} aria-hidden="true">{mark ? <MarkIcon mark={mark} /> : LETTERS[i]}</span>
            <span>{c}</span>
          </button>
        );
      })}
    </div>
  );
}
