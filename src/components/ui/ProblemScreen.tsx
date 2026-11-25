import type { ReactNode } from 'react';
import { Blob, type BlobColor, type Mood } from '@/components/blob/Blob';
import styles from './ProblemScreen.module.css';

type Props = {
  title: string;
  message?: string;
  /** Short Korean line for parents (spec §5.1). */
  parentNote?: string;
  mood?: Mood;
  color?: BlobColor;
  /** Button or link. */
  action?: ReactNode;
};

export function ProblemScreen({ title, message, parentNote, mood = 'sleepy', color = 'sunny', action }: Props) {
  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <Blob color={color} mood={mood} size={140} />
        <h1 className={styles.title}>{title}</h1>
        {message ? <p className={styles.message}>{message}</p> : null}
        {parentNote ? <p className={styles.note} lang="ko">{parentNote}</p> : null}
        {action}
      </div>
    </main>
  );
}

/** The black pill with a yellow arrow circle, as an anchor or button child. */
export function PillArrow() {
  return (
    <span className={styles.arrow} aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F1F1F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </span>
  );
}
