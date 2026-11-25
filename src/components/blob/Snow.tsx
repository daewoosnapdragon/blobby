'use client';
import { useEffect, useState } from 'react';
import { prefersReducedMotion } from './useNudge';
import styles from './scene.module.css';

// A few slow, small flakes (fixed values, no randomness). left %, size px, fall seconds, delay seconds, sway px.
const FLAKES = [
  [6, 7, 16, 0, 12], [15, 5, 20, 6, -10], [24, 8, 18, 11, 14], [33, 5, 22, 3, -12], [42, 6, 17, 9, 10],
  [51, 8, 21, 1, -14], [60, 5, 19, 13, 12], [69, 7, 23, 5, -10], [78, 6, 18, 8, 14], [86, 8, 20, 2, -12],
  [93, 5, 22, 10, 10], [47, 5, 24, 15, -8],
];

/** Light snow behind the page (home, Dec 20 to Feb 28). Decorative and click-through; not rendered at all under reduced motion. */
export function Snow() {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(!prefersReducedMotion()); }, []);
  if (!on) return null;
  return (
    <div className={styles.snow} data-snow aria-hidden="true">
      {FLAKES.map(([left, size, dur, delay, sway], i) => (
        <span
          key={i}
          data-flake
          className={styles.flake}
          style={{ left: `${left}%`, width: size, height: size, animationDuration: `${dur}s`, animationDelay: `-${delay}s`, ['--sway' as string]: `${sway}px` }}
        />
      ))}
    </div>
  );
}
