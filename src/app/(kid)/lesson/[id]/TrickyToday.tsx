import Link from 'next/link';
import { SKILLS, type SkillKey } from '@/lib/skills';
import styles from './lessonDone.module.css';

/** End-of-lesson card: what to practice again, in kid words. Never a score or a count of mistakes. */
export function TrickyToday({ skills }: { skills: SkillKey[] }) {
  if (skills.length === 0) return <p className={styles.trickyNone}>Nothing tricky today!</p>;
  return (
    <section className={styles.tricky} aria-labelledby="tricky-title">
      <h2 id="tricky-title" className={styles.trickyTitle}>Tricky today</h2>
      <ul className={styles.trickyList}>
        {skills.map((k) => (
          <li key={k} className={styles.trickyItem}>
            <span>{SKILLS[k].kid}</span>
            <Link href={`/practice?skill=${k}`} className={styles.trickyBtn} aria-label={`Practice again: ${SKILLS[k].kid}`}>Practice again</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
