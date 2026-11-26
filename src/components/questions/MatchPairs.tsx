'use client';
import { useMemo, useState } from 'react';
import { checkAnswer } from '@/lib/questions/check';
import { PillButton } from '@/components/ui/PillButton';
import { GROUP_TINTS, seededShuffle, type QProps } from './types';
import s from './questions.module.css';

/**
 * Match pairs: tap a left tile, then a right tile, to pair them; tap a paired tile to unpair it. Check the whole board.
 * `matches[left]` is the index in `q.pairs` of the right tile it is paired with: by position, never by text, so two
 * tiles may show the same text. A miss marks only the off pairs; the board stays through Try again (this stays
 * mounted while status goes wrong → idle).
 */
export function MatchPairs({ q, status, onAnswer }: QProps<'match_pairs'>) {
  const [matches, setMatches] = useState<(number | null)[]>(() => q.pairs.map(() => null));
  const [selected, setSelected] = useState<number | null>(null);
  const locked = status !== 'idle';
  const rightOrder = useMemo(
    () => seededShuffle(q.pairs.map((_, i) => i), q.pairs.map((p) => `${p.left}|${p.right}`).join('\n')),
    [q.pairs],
  );
  /** right index → the left it is paired with */
  const leftOf = new Map<number, number>();
  matches.forEach((m, i) => { if (m !== null) leftOf.set(m, i); });

  function tapLeft(i: number) {
    if (locked) return;
    if (matches[i] !== null) {
      setMatches((ms) => ms.map((m, j) => (j === i ? null : m)));
      return;
    }
    setSelected((cur) => (cur === i ? null : i));
  }
  function tapRight(r: number) {
    if (locked) return;
    const l = leftOf.get(r);
    if (l !== undefined) setMatches((ms) => ms.map((m, j) => (j === l ? null : m)));
    else if (selected !== null) {
      setMatches((ms) => ms.map((m, j) => (j === selected ? r : m)));
      setSelected(null);
    }
  }

  const ready = matches.every((m) => m !== null);
  /** Mark and tint for the pair whose left is `i` (k = i), or nothing when `i` is unpaired. */
  function look(i: number | undefined) {
    if (i === undefined || matches[i] === null) return {};
    const off = status === 'wrong' && matches[i] !== i;
    return {
      'data-pair': i,
      'data-mark': status === 'right' ? 'right' : off ? 'wrong' : undefined,
      style: off ? undefined : { background: GROUP_TINTS[i % GROUP_TINTS.length] },
    };
  }

  return (
    <div className={s.stack}>
      <div className={s.pairCols} role="group" aria-label="Pairs">
        {q.pairs.map((p, i) => {
          const r = rightOrder[i];
          return [
            <div key={`l${i}`} className={s.pairCell}>
              <button type="button" className={`${s.tile} ${s.pairTile}`} data-side="left" aria-pressed={selected === i}
                aria-disabled={locked || undefined} onClick={() => tapLeft(i)} {...look(i)}>
                {p.left}
              </button>
              {matches[i] !== null ? <span className={s.pairLine} data-pair={i} aria-hidden="true" /> : null}
            </div>,
            <div key={`r${r}`} className={s.pairCell}>
              <button type="button" className={`${s.tile} ${s.pairTile}`} data-side="right"
                aria-disabled={locked || undefined} onClick={() => tapRight(r)} {...look(leftOf.get(r))}>
                {q.pairs[r].right}
              </button>
            </div>,
          ];
        })}
      </div>
      <div className={s.checkSlot}>
        {ready && !locked ? (
          <div className={s.appear}>
            <PillButton size="lg" onClick={() => onAnswer(checkAnswer(q, { matches: matches.map((m) => m ?? -1) }))}>Check</PillButton>
          </div>
        ) : !ready ? (
          <p className={s.helper}>Tap a word on the left, then its match.</p>
        ) : null}
      </div>
    </div>
  );
}
