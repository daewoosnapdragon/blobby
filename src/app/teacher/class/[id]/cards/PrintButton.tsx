'use client';
import styles from './cards.module.css';

export function PrintButton() {
  return <button type="button" className={styles.print} onClick={() => window.print()}>Print cards</button>;
}
