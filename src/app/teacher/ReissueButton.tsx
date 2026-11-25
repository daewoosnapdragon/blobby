'use client';
import styles from './teacher.module.css';

/** Submits its form only after a clear confirm. */
export function ReissueButton() {
  return (
    <button
      type="submit"
      className={styles.ghost}
      onClick={(e) => {
        if (!window.confirm('Make a new card link? The old card will stop working. Devices already signed in stay signed in.')) e.preventDefault();
      }}
    >
      Make a new card link
    </button>
  );
}
