'use client';
import { useNudge } from './useNudge';
import styles from './scene.module.css';

const LINES = { morning: 'Good morning!', bedtime: 'Time for bed, see you tomorrow!' } as const;

/** A friendly line under the greeting. The slot is always there (fixed height), so the words appearing never move anything. */
export function NudgeLine() {
  const nudge = useNudge();
  return (
    <p className={styles.nudge} data-nudge-slot data-nudge={nudge ?? undefined} aria-live="polite">
      {nudge ? LINES[nudge] : ''}
    </p>
  );
}
