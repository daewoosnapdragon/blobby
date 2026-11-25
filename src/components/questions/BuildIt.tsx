'use client';
import { useMemo, useState } from 'react';
import { checkAnswer } from '@/lib/questions/check';
import { PillButton } from '@/components/ui/PillButton';
import { seededShuffle, type QProps } from './types';
import s from './questions.module.css';

/** Build it: tap word tiles into order; tap a placed tile to send it back. */
export function BuildIt({ q, status, onAnswer }: QProps<'build_it'>) {
  const pool = useMemo(() => {
    const all = [...q.tiles, ...(q.distractors ?? [])];
    return seededShuffle(all, all.join('\u0001'));
  }, [q]);
  const [placed, setPlaced] = useState<number[]>([]);
  const locked = status !== 'idle';

  const place = (k: number) => { if (!locked) setPlaced((p) => [...p, k]); };
  const unplace = (k: number) => { if (!locked) setPlaced((p) => p.filter((x) => x !== k)); };
  const ready = placed.length === q.tiles.length;

  return (
    <div className={s.stack}>
      <div className={s.answerRow} role="group" aria-label="Your sentence" data-mark={locked ? status : undefined}>
        {placed.map((k) => (
          <button key={k} type="button" className={s.tile} aria-disabled={locked || undefined} onClick={() => unplace(k)}>
            {pool[k]}
          </button>
        ))}
      </div>
      <div className={s.bank} role="group" aria-label="Word tiles">
        {pool.map((t, k) =>
          placed.includes(k) ? (
            <span key={k} className={s.tileGhost} aria-hidden="true">{t}</span>
          ) : (
            <button key={k} type="button" className={s.tile} aria-disabled={locked || undefined} onClick={() => place(k)}>
              {t}
            </button>
          ),
        )}
      </div>
      <div className={s.checkSlot}>
        {ready && !locked ? (
          <div className={s.appear}>
            <PillButton size="lg" onClick={() => onAnswer(checkAnswer(q, { order: placed.map((k) => pool[k]) }))}>Check</PillButton>
          </div>
        ) : (
          <p className={s.helper}>Tap the words in order.</p>
        )}
      </div>
    </div>
  );
}
