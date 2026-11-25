import Link from 'next/link';
import type { Ref } from 'react';
import { StarCount } from '@/components/ui/StarCount';
import { CloseIcon } from '@/components/ui/icons';
import s from './questions.module.css';

/** Close, progress, stars: the lesson's top bar (D-Question). Shared by the player and the lesson-done moment. */
export function TopBar({
  closeHref = '/', closeLabel = 'Close lesson', current, total, stars, starsRef,
}: {
  closeHref?: string; closeLabel?: string; current: number; total: number; stars: number; starsRef?: Ref<HTMLDivElement>;
}) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className={s.topBar}>
      <Link href={closeHref} className={s.close} aria-label={closeLabel}>
        <CloseIcon />
      </Link>
      <div
        className={s.progress}
        role="progressbar"
        aria-label={`Question ${current} of ${total}`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={current}
      >
        <div className={s.progressFill} style={{ width: `${pct}%` }} />
      </div>
      <StarCount value={stars} variant="plain" ref={starsRef} />
    </div>
  );
}
