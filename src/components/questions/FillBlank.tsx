'use client';
import { useState } from 'react';
import { checkAnswer } from '@/lib/questions/check';
import type { QProps } from './types';
import s from './questions.module.css';

/** Fill the blank: the sentence with a gap, and word chips. */
export function FillBlank({ q, status, onAnswer }: QProps<'fill_blank'>) {
  const [picked, setPicked] = useState<number | null>(null);
  const locked = status !== 'idle';
  function choose(i: number) {
    if (locked) return;
    setPicked(i);
    onAnswer(checkAnswer(q, { choice: i }));
  }
  const filled = locked && picked !== null ? q.choices[picked] : null;
  return (
    <div className={s.stack}>
      <p className={s.sentence}>
        {q.before.trim() ? <>{q.before.trim()} </> : null}
        <span className={s.blank} data-mark={filled ? status : undefined}>
          {filled ?? <span className="sr-only">blank</span>}
        </span>
        {q.after.trim() ? <> {q.after.trim()}</> : null}
      </p>
      <div className={s.chips}>
        {q.choices.map((c, i) => (
          <button key={i} type="button" className={s.chip} data-mark={locked && picked === i ? status : undefined} aria-disabled={locked || undefined} onClick={() => choose(i)}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
