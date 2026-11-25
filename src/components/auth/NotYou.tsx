'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './NotYou.module.css';

export const notYouText = 'Not you?';

/**
 * Clears the kid cookie, then goes to /join (siblings sharing a phone).
 * `compact` looks like small text in a top bar but keeps a 44px touch target.
 */
export function NotYou({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onClick() {
    setBusy(true);
    try {
      await fetch('/api/switch', { method: 'POST' });
    } finally {
      router.push('/join');
      router.refresh();
    }
  }
  return (
    <button type="button" className={`${styles.btn} ${compact ? styles.compact : ''}`} onClick={onClick} disabled={busy}>
      {notYouText}
    </button>
  );
}
