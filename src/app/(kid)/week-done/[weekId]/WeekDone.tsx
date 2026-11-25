'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Blob, type BlobColor, type Hat } from '@/components/blob/Blob';
import { useNudge } from '@/components/blob/useNudge';
import { PillButton } from '@/components/ui/PillButton';
import { Card } from '@/components/ui/Card';
import { ChestIcon, CloseIcon, Sparkle, StarIcon } from '@/components/ui/icons';
import styles from './weekDone.module.css';

// D-Done sparkles: dots, then two star doodles, popping in 50ms apart.
const DOTS = [
  { left: 6, top: 14, size: 12, color: 'var(--pink)', delay: 300 },
  { left: 86, top: 18, size: 10, color: 'var(--mint)', delay: 350 },
  { left: 20, top: 41, size: 8, color: 'var(--blue)', delay: 400 },
  { left: 90, top: 59, size: 12, color: 'var(--yellow)', delay: 450 },
  { left: 3, top: 72, size: 9, color: 'var(--mint)', delay: 500 },
];

const COUNT_DELAY = 600;
const COUNT_MS = 900;

/** Week done (D-Done): double jump, staggered sparkles, stars counting up over 900ms, the chest total. */
export function WeekDone({ number, skill, weekStars, totalStars, color, hat = null }: {
  number: number; skill: string; weekStars: number; totalStars: number; color: BlobColor; hat?: Hat | null;
}) {
  const nudge = useNudge();
  const [t, setT] = useState(0);
  useEffect(() => {
    let reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}
    if (reduce) return setT(1);
    let raf = 0;
    const start = performance.now() + COUNT_DELAY;
    const step = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / COUNT_MS));
      setT(p);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  const eased = 1 - Math.pow(1 - t, 3);
  const week = Math.round(weekStars * eased);
  const chest = totalStars - weekStars + week;

  return (
    <main className={styles.screen}>
      <Link href="/" className={styles.close} aria-label="Close"><CloseIcon /></Link>

      <div className={styles.layout}>
        <div className={styles.stage} aria-hidden="true">
          {DOTS.map((d, i) => (
            <span key={i} className={styles.pop} style={{ left: `${d.left}%`, top: `${d.top}%`, width: d.size, height: d.size, background: d.color, borderRadius: '50%', animationDelay: `${d.delay}ms` }} />
          ))}
          <Sparkle size={28} className={styles.pop} style={{ left: '72%', top: '7%', animationDelay: '380ms' }} />
          <Sparkle size={20} color="#FFD95A" className={styles.pop} style={{ left: '16%', top: '24%', animationDelay: '430ms' }} />
          <div className={styles.blob}>
            <Blob color={color} mood="happy" size="var(--done-blob, 216px)" reaction="cheer" hat={hat} accessory={nudge === 'bedtime' ? 'pajamas' : null} />
          </div>
        </div>

        <div className={styles.info}>
          <div className={styles.head}>
            <h1 className={styles.title}>Week {number} done!</h1>
            {/* The skill is shown exactly as entered, as a pastel tag ("I statements" stays capitalized). */}
            <p className={styles.sub}>You practiced <span className={styles.skillTag}>{skill}</span></p>
          </div>

          <Card className={styles.card}>
            <div className={styles.row}>
              <StarIcon size={34} />
              <div className={styles.label}>Stars this week</div>
              <div className={styles.num}>
                <span aria-hidden="true" data-testid="week-stars">+{week}</span>
                <span className="sr-only">+{weekStars}</span>
              </div>
            </div>
            <div className={styles.rule} />
            <div className={styles.row}>
              <ChestIcon width={34} height={30} stroke={5} />
              <div className={styles.label}>
                <div>Treasure chest</div>
                <div className={styles.note}>Opens when you’re back at school</div>
              </div>
              <div className={styles.num}>
                <span aria-hidden="true" data-testid="chest-total">{chest}</span>
                <span className="sr-only">{totalStars} stars</span>
              </div>
            </div>
          </Card>

          <div className={styles.spacer} />
          <PillButton href="/">Back to my plan</PillButton>
        </div>
      </div>
    </main>
  );
}
