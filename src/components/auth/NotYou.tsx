'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './NotYou.module.css';

export const notYouText = 'Not you?';

/** Clears the kid cookie, then goes to /join. Task 8 places it in the home top bar. */
export function NotYou() {
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
    <button type="button" className={styles.btn} onClick={onClick} disabled={busy}>
      {notYouText}
    </button>
  );
}
