'use client';
import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Blob, type BlobColor } from '@/components/blob/Blob';
import { PillButton } from '@/components/ui/PillButton';
import { StarIcon } from '@/components/ui/icons';
import { TopBar } from '@/components/questions/TopBar';
import styles from './practice.module.css';

/** The end of a free-practice set: what the server says the kid earned, then another set or home. */
export function PracticeDone({ name, color, stars, earned, saving }: {
  name: string; color: BlobColor; stars: number; earned: number; saving: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className={styles.screen}>
      <TopBar closeHref="/" closeLabel="Close practice" current={1} total={1} stars={stars} />

      <div className={styles.main}>
        <div className={styles.stage}>
          <span className={`${styles.dot} ${styles.d1}`} />
          <span className={`${styles.dot} ${styles.d2}`} />
          <span className={`${styles.dot} ${styles.d3}`} />
          <Blob color={color} mood="happy" size="var(--pd-blob, 180px)" reaction="hop" />
        </div>

        <div className={styles.text} role="status" aria-live="polite">
          <h1 className={styles.title}>Practice done!</h1>
          <p className={styles.sub}>Nice work, {name}!</p>
          {saving ? (
            <p className={styles.result}>Saving your stars…</p>
          ) : earned > 0 ? (
            <p className={styles.stars}>
              <StarIcon size={34} />
              You earned {earned} {earned === 1 ? 'star' : 'stars'}
            </p>
          ) : (
            <p className={styles.stars}>Nice practice!</p>
          )}
        </div>

        <div className={styles.spacer} />

        <div className={styles.actions}>
          <PillButton onClick={() => startTransition(() => router.refresh())} disabled={pending || saving}>
            {pending ? 'Getting new questions…' : 'Practice again'}
          </PillButton>
          <Link href="/" className={styles.home}>Back home</Link>
        </div>
      </div>
    </div>
  );
}
