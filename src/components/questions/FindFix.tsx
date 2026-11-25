'use client';
import { useState } from 'react';
import { checkAnswer } from '@/lib/questions/check';
import type { QProps } from './types';
import s from './questions.module.css';

/** Find and fix: tap the mistake, then choose the fix. The fixes appear only once the mistake is tapped. */
export function FindFix({ q, status, onAnswer, onFound }: QProps<'find_fix'> & { onFound?: (found: boolean) => void }) {
  const [tapped, setTapped] = useState<number | null>(null);
  const [fix, setFix] = useState<number | null>(null);
  const locked = status !== 'idle';
  const found = tapped === q.wrongIndex;

  function tapWord(i: number) {
    if (locked) return;
    setTapped(i);
    setFix(null);
    onFound?.(i === q.wrongIndex);
    // Tapping a word that is fine is a wrong answer; tapping the mistake waits for the fix.
    if (i !== q.wrongIndex) onAnswer(checkAnswer(q, { tapped: i, fix: -1 }));
  }
  function chooseFix(j: number) {
    if (locked || !found) return;
    setFix(j);
    onAnswer(checkAnswer(q, { tapped: q.wrongIndex, fix: j }));
  }

  return (
    <div className={s.stack}>
      <div className={s.sentenceWords} role="group" aria-label="Sentence">
        {q.words.map((w, i) => {
          let mark: string | undefined;
          if (i === tapped && i !== q.wrongIndex && status === 'wrong') mark = 'wrong';
          if (i === q.wrongIndex && found) mark = status === 'right' ? 'right' : 'selected';
          const shown = mark === 'right' && fix !== null ? q.fixes[fix] : w;
          return (
            <button key={i} type="button" className={s.sentenceWord} data-mark={mark} aria-pressed={i === q.wrongIndex && found} aria-disabled={locked || undefined} onClick={() => tapWord(i)}>
              {shown}
            </button>
          );
        })}
      </div>
      {found ? (
        <div className={`${s.stack} ${s.appear}`}>
          <p className={s.helper}>Change <strong>{q.words[q.wrongIndex]}</strong> to:</p>
          <div className={s.chips} role="group" aria-label="Fixes">
            {q.fixes.map((f, j) => (
              <button key={j} type="button" className={s.chip} data-mark={locked && fix === j ? status : undefined} aria-disabled={locked || undefined} onClick={() => chooseFix(j)}>
                {f}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
