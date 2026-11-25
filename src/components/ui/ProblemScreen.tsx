import type { ReactNode } from 'react';
import { Blob, type Accessory, type BlobColor, type Mood } from '@/components/blob/Blob';
import styles from './ProblemScreen.module.css';

type Props = {
  title: string;
  message?: string;
  /** Short Korean line for parents (spec §5.1). */
  parentNote?: string;
  mood?: Mood;
  color?: BlobColor;
  accessory?: Accessory;
  /** Button or link. */
  action?: ReactNode;
  /** 'overlay' sits on top of the page (offline); the page underneath stays mounted. */
  variant?: 'page' | 'overlay';
  /** 'loading' keeps the blob bouncing; the title is announced politely. */
  bounce?: boolean;
};

export function ProblemScreen({ title, message, parentNote, mood = 'sleepy', color = 'sunny', accessory = null, action, variant = 'page', bounce = false }: Props) {
  const Tag = variant === 'overlay' ? 'div' : 'main';
  return (
    <Tag className={`${styles.screen} ${variant === 'overlay' ? styles.overlay : ''}`}>
      <div className={styles.card}>
        <div className={bounce ? styles.bounce : undefined}>
          <Blob color={color} mood={mood} size="var(--ps-blob, 140px)" accessory={accessory} />
        </div>
        <h1 className={styles.title}>{title}</h1>
        {message ? <p className={styles.message}>{message}</p> : null}
        {parentNote ? <p className={styles.note} lang="ko">{parentNote}</p> : null}
        {action}
      </div>
    </Tag>
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
