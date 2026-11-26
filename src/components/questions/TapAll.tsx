'use client';
import { useState } from 'react';
import { checkAnswer } from '@/lib/questions/check';
import { PillButton } from '@/components/ui/PillButton';
import type { Mark, QProps } from './types';
import s from './questions.module.css';

/**
 * Tap them all: tap every word that fits, then Check the whole board. A miss marks only the extra words;
 * the pressed words stay pressed through Try again (this stays mounted while status goes wrong → idle).
 */
export function TapAll({ q, status, onAnswer }: QProps<'tap_all'>) {
  const [tapped, setTapped] = useState<ReadonlySet<number>>(() => new Set());
  const locked = status !== 'idle';

  function toggle(i: number) {
    if (locked) return;
    setTapped((t) => {
      const next = new Set(t);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function markFor(i: number): Mark {
    if (!tapped.has(i)) return undefined;
    if (status === 'right') return 'right';
    if (status === 'wrong' && !q.answers.includes(i)) return 'wrong';
    return 'selected';
  }

  return (
    <div className={s.stack}>
      <div className={s.sentenceWords} role="group" aria-label="Sentence">
        {q.words.map((w, i) => (
          <button key={i} type="button" className={s.sentenceWord} data-mark={markFor(i)} aria-pressed={tapped.has(i)} aria-disabled={locked || undefined} onClick={() => toggle(i)}>
            {w}
          </button>
        ))}
      </div>
      <div className={s.checkSlot}>
        {tapped.size > 0 && !locked ? (
          <div className={s.appear}>
            <PillButton size="lg" onClick={() => onAnswer(checkAnswer(q, { tapped: [...tapped] }))}>Check</PillButton>
          </div>
        ) : !locked ? (
          <p className={s.helper}>Tap every word that fits, then check.</p>
        ) : null}
      </div>
    </div>
  );
}
