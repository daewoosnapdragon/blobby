'use client';
import { useState } from 'react';
import { checkAnswer } from '@/lib/questions/check';
import { MarkIcon } from './Marks';
import type { QProps } from './types';
import s from './questions.module.css';

/** Listen and tap: hear a word (Hear it), tap it in print. Choices may carry a picture later (spec 5.6). */
export function ListenTap({ q, status, onAnswer }: QProps<'listen_tap'>) {
  const [picked, setPicked] = useState<number | null>(null);
  const locked = status !== 'idle';
  function choose(i: number) {
    if (locked) return;
    setPicked(i);
    onAnswer(checkAnswer(q, { choice: i }));
  }
  return (
    <div className={s.wordGrid} data-count={q.choices.length}>
      {q.choices.map((c, i) => {
        const mark = locked && picked === i ? status : undefined;
        return (
          <button key={i} type="button" className={s.word} data-mark={mark} aria-disabled={locked || undefined} onClick={() => choose(i)}>
            {c.image ? <img src={c.image} alt="" className={s.wordImg} /> : null}
            <span>{c.text}</span>
            {mark ? <span className={s.cornerMark} aria-hidden="true"><MarkIcon mark={mark} /></span> : null}
          </button>
        );
      })}
    </div>
  );
}
