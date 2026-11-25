'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import styles from './home.module.css';

/** The week rail: scrolls sideways on a phone (starting with "you are here" in view); a grid on wider screens. */
export function Rail({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const here = el?.querySelector<HTMLElement>('[data-current]');
    if (!el || !here) return;
    if (here.offsetLeft + here.offsetWidth > el.clientWidth) el.scrollLeft = here.offsetLeft - 18;
  }, []);
  return <div ref={ref} className={styles.rail} data-testid="week-rail">{children}</div>;
}
