'use client';
import type { FailedSave } from './useRecordAttempt';
import styles from './SaveRetry.module.css';

/**
 * A small tap-to-retry note for answers that couldn't be saved (free practice). It never blocks the screen:
 * the kid can keep going and tap it whenever. Retries reuse each answer's clientAttemptId.
 */
export function SaveRetry({ failed, onRetry, busy }: { failed: FailedSave[]; onRetry: () => void; busy: boolean }) {
  if (failed.length === 0) return null;
  const label = busy
    ? 'Saving…'
    : failed.length === 1
      ? 'Couldn’t save that one. Tap to try again'
      : `Couldn’t save ${failed.length} answers. Tap to try again`;
  return (
    <div className={styles.wrap} aria-live="polite">
      <button type="button" className={styles.button} onClick={onRetry} disabled={busy}>
        {label}
      </button>
    </div>
  );
}
