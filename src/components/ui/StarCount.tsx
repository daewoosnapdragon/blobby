import type { Ref } from 'react';
import { StarIcon } from './icons';
import styles from './ui.module.css';

/** The star total. "pill" on a white pill (home), "plain" in the lesson top bar. The number never animates (spec 5.11). */
export function StarCount({ value, variant = 'pill', ref }: { value: number; variant?: 'pill' | 'plain'; ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} role="img" aria-label={`${value} stars`} className={variant === 'pill' ? styles.starPill : styles.starPlain}>
      <StarIcon size={variant === 'pill' ? 22 : 20} />
      <span>{value}</span>
    </div>
  );
}
