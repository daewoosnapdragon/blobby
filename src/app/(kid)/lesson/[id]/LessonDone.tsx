'use client';
import { useEffect, useRef, useState } from 'react';
import { Blob, type BlobColor } from '@/components/blob/Blob';
import { PillButton } from '@/components/ui/PillButton';
import { StarIcon, STAR_PATH } from '@/components/ui/icons';
import { TopBar } from '@/components/questions/TopBar';
import { STAR_VALUES } from '@/lib/stars';
import styles from './lessonDone.module.css';

export type DoneState =
  | { kind: 'saving' }
  | { kind: 'error' }
  | { kind: 'saved'; firstTime: boolean; nextHref: string; starsBefore: number; starsAfter: number };

const FLY = 5;

/**
 * The short lesson-done moment. First time: "+10 stars", and the stars fly to the counter (transform only,
 * skipped under reduced motion). A redo: "Nice practice!" and no stars.
 */
export function LessonDone({ state, name, color, stars, onRetry }: {
  state: DoneState; name: string; color: BlobColor; stars: number; onRetry: () => void;
}) {
  const pill = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLSpanElement>(null);
  const flyers = useRef<(SVGSVGElement | null)[]>([]);
  const [landed, setLanded] = useState(false);

  const saved = state.kind === 'saved' ? state : null;
  const shown = saved ? (landed ? saved.starsAfter : saved.starsBefore) : stars;

  useEffect(() => {
    if (!saved) return;
    if (!saved.firstTime || saved.starsAfter === saved.starsBefore) return setLanded(true);
    let reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}
    const from = source.current?.getBoundingClientRect();
    const to = pill.current?.querySelector('svg')?.getBoundingClientRect();
    const els = flyers.current.filter((x): x is SVGSVGElement => !!x);
    if (reduce || !from || !to || els.length === 0 || typeof els[0].animate !== 'function') return setLanded(true);

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const anims = els.map((el, i) => {
      el.style.left = `${from.left + from.width / 2 - 11}px`;
      el.style.top = `${from.top + from.height / 2 - 11}px`;
      // a little arc: each star drifts sideways before it heads for the counter
      const side = (i - (FLY - 1) / 2) * 14;
      return el.animate(
        [
          { transform: 'translate(0, 0) scale(0.6)', visibility: 'visible' },
          { transform: `translate(${side}px, -28px) scale(1.1)`, offset: 0.3, visibility: 'visible' },
          { transform: `translate(${dx}px, ${dy}px) scale(0.8)`, visibility: 'visible' },
        ],
        { duration: 700, delay: 350 + i * 70, easing: 'cubic-bezier(0.77, 0, 0.175, 1)', fill: 'both' },
      );
    });
    let cancelled = false;
    anims[anims.length - 1].finished.then(() => {
      if (cancelled) return;
      for (const a of anims) a.cancel();
      setLanded(true);
    }).catch(() => {});
    return () => { cancelled = true; for (const a of anims) a.cancel(); };
  }, [saved]);

  return (
    <div className={styles.screen}>
      <TopBar closeHref="/" closeLabel="Close" current={1} total={1} stars={shown} starsRef={pill} />

      <div className={styles.main}>
        <div className={styles.stage}>
          <span className={`${styles.dot} ${styles.d1}`} />
          <span className={`${styles.dot} ${styles.d2}`} />
          <span className={`${styles.dot} ${styles.d3}`} />
          <Blob color={color} mood={state.kind === 'error' ? 'oops' : 'happy'} size="var(--ld-blob, 180px)" reaction={saved ? 'hop' : null} />
        </div>

        <div className={styles.text} role="status" aria-live="polite">
          <h1 className={styles.title}>Lesson done!</h1>
          <p className={styles.sub}>Nice work, {name}!</p>
          {state.kind === 'saving' ? (
            <p className={styles.result}>Saving your stars…</p>
          ) : state.kind === 'error' ? (
            <p className={styles.result}>That didn’t save. Check the internet, then try again.</p>
          ) : state.firstTime ? (
            <p className={styles.stars}>
              <span ref={source} className={styles.starIcon}><StarIcon size={34} /></span>
              +{STAR_VALUES.lesson} stars
            </p>
          ) : (
            <p className={styles.stars}>Nice practice!</p>
          )}
          {saved && !saved.firstTime ? <p className={styles.result}>You already got the stars for this one.</p> : null}
          {saved && saved.nextHref !== '/' ? <p className={styles.result}>And that finishes the week!</p> : null}
        </div>

        <div className={styles.spacer} />

        {state.kind === 'error' ? (
          <PillButton onClick={onRetry}>Try again</PillButton>
        ) : saved ? (
          <PillButton href={saved.nextHref}>{saved.nextHref === '/' ? 'Back to my plan' : 'Next'}</PillButton>
        ) : (
          <PillButton disabled>Back to my plan</PillButton>
        )}
      </div>

      {saved?.firstTime
        ? Array.from({ length: FLY }, (_, i) => (
            <svg key={i} ref={(el) => { flyers.current[i] = el; }} className={styles.flyer} width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path d={STAR_PATH} fill="#FFD95A" stroke="#1F1F1F" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          ))
        : null}
    </div>
  );
}
