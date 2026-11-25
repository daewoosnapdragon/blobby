import type { ReactNode } from 'react';
import styles from './ui.module.css';

/** A large white card: 28px radius, no border (spec 5.10). */
export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={[styles.card, className].filter(Boolean).join(' ')} {...rest}>{children}</div>;
}
