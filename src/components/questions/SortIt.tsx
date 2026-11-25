'use client';
import { useState } from 'react';
import { checkAnswer } from '@/lib/questions/check';
import { PillButton } from '@/components/ui/PillButton';
import type { QProps } from './types';
import s from './questions.module.css';

const GROUP_TINTS = ['#B7E1D1', '#FFB5C1', '#A9D3FF', '#FFE59A'];

/** Sort it: tap a word, then the group it belongs to. Tap a sorted word to send it back. */
export function SortIt({ q, status, onAnswer }: QProps<'sort_it'>) {
  const [placement, setPlacement] = useState<(number | null)[]>(() => q.items.map(() => null));
  const [selected, setSelected] = useState<number | null>(null);
  const locked = status !== 'idle';

  function pick(i: number) {
    if (!locked) setSelected((cur) => (cur === i ? null : i));
  }
  function putIn(g: number) {
    if (locked || selected === null) return;
    setPlacement((p) => p.map((v, i) => (i === selected ? g : v)));
    setSelected(null);
  }
  function takeBack(i: number) {
    if (!locked) setPlacement((p) => p.map((v, j) => (j === i ? null : v)));
  }
  const unsorted = q.items.map((it, i) => ({ it, i })).filter(({ i }) => placement[i] === null);
  const ready = unsorted.length === 0;

  return (
    <div className={s.stack}>
      <div className={s.bank} role="group" aria-label="Words to sort">
        {unsorted.map(({ it, i }) => (
          <button key={i} type="button" className={s.tile} aria-pressed={selected === i} aria-disabled={locked || undefined} onClick={() => pick(i)}>
            {it.text}
          </button>
        ))}
        {ready ? <span className={s.helper}>All sorted!</span> : null}
      </div>
      <div className={s.groups} data-count={q.groups.length}>
        {q.groups.map((g, gi) => (
          <div key={gi} className={s.group} role="group" aria-label={g} data-mark={locked ? status : undefined}>
            <button
              type="button"
              className={s.groupHead}
              style={{ background: GROUP_TINTS[gi % GROUP_TINTS.length] }}
              data-armed={selected !== null && !locked ? '' : undefined}
              aria-disabled={locked || undefined}
              onClick={() => putIn(gi)}
            >
              {g}
            </button>
            <div className={s.groupBody}>
              {q.items.map((it, i) =>
                placement[i] === gi ? (
                  <button key={i} type="button" className={s.tile} aria-disabled={locked || undefined} onClick={() => takeBack(i)}>
                    {it.text}
                  </button>
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>
      <div className={s.checkSlot}>
        {ready && !locked ? (
          <div className={s.appear}>
            <PillButton size="lg" onClick={() => onAnswer(checkAnswer(q, { placement: placement.map((v) => v ?? -1) }))}>Check</PillButton>
          </div>
        ) : !ready ? (
          <p className={s.helper}>Tap a word, then tap its group.</p>
        ) : null}
      </div>
    </div>
  );
}
