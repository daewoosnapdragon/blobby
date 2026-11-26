import styles from './PracticeBar.module.css';

/** Shown across the kid screens while the teacher is signed in as a class's practice student. */
export function PracticeBar({ classId }: { classId: string }) {
  return (
    <div className={styles.bar} role="note">
      <span>You&apos;re trying this as a student.</span>
      <a href={`/teacher/class/${classId}`}>Back to your class</a>
    </div>
  );
}
