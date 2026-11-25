'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import styles from './home.module.css';

/** The sideways week rail; starts scrolled so "you are here" is in view. */
export function Rail({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const here = el?.querySelector<HTMLElement>('[data-current]');
    if (!el || !here) return;
    if (here.offsetLeft + here.offsetWidth > el.clientWidth) el.scrollLeft = here.offsetLeft - 18;
  }, []);
  return <div ref={ref} className={styles.rail}>{children}</div>;
}
