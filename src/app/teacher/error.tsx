'use client';
import { startTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './teacher.module.css';

/** A teacher page threw (bad settings, database down): calm words and a way to retry. */
export default function TeacherError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  // reset() alone re-renders the cached failed server result; refresh() refetches it first.
  const retry = () => startTransition(() => { router.refresh(); reset(); });
  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <div className={styles.card} style={{ maxWidth: 560, margin: '48px auto' }}>
          <h1 className={styles.h1}>Something went wrong</h1>
          <p className={styles.sub}>The page could not load. Nothing was lost. Please try again.</p>
          <button type="button" className={styles.solid} onClick={retry}>Try again</button>
          <p className={styles.empty} style={{ fontSize: 15, marginTop: 20 }}>
            If this keeps happening, check the app’s settings in Vercel.
          </p>
          {error.digest ? <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 0' }}>Support code: {error.digest}</p> : null}
        </div>
      </main>
    </div>
  );
}
