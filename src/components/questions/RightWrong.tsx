'use client';
import { useState } from 'react';
import { checkAnswer } from '@/lib/questions/check';
import { MarkIcon } from './Marks';
import type { QProps } from './types';
import s from './questions.module.css';

/** Right or wrong: one sentence, the kid taps Yes (it's right) or No (it isn't). */
export function RightWrong({ q, status, onAnswer }: QProps<'right_wrong'>) {
  const [picked, setPicked] = useState<boolean | null>(null);
  const locked = status !== 'idle';
  function choose(yes: boolean) {
    if (locked) return;
    setPicked(yes);
    onAnswer(checkAnswer(q, { yes }));
  }
  const button = (yes: boolean) => (
    <button type="button" className={s.yesNoBtn} data-mark={locked && picked === yes ? status : undefined}
      aria-disabled={locked || undefined} onClick={() => choose(yes)}>
      <MarkIcon mark={yes ? 'right' : 'wrong'} />
      <span>{yes ? 'Yes' : 'No'}</span>
    </button>
  );
  return (
    <div className={s.stack}>
      <p className={s.sentenceCard}>{q.sentence}</p>
      <div className={s.yesNo}>
        {button(true)}
        {button(false)}
      </div>
    </div>
  );
}
