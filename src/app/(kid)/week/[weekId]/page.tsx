import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getWeek, studentFromRequest } from '@/lib/db/kid';
import { toBlobColor } from '@/lib/blobColors';
import { Blob } from '@/components/blob/Blob';
import { StarCount } from '@/components/ui/StarCount';
import { NotOpenScreen } from '@/components/ui/KidProblems';
import { ArrowIcon, BackIcon, CheckIcon } from '@/components/ui/icons';
import styles from './week.module.css';

export const dynamic = 'force-dynamic';

/** A week's lessons (ruling R23): done checks; tap to start, or to redo for practice. */
export default async function WeekPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const student = await studentFromRequest();
  if (!student) redirect('/join');
  // Any open week of any plan assigned to this kid, not only home's current plan.
  const home = await getWeek(student.id, weekId);
  if (!home) return <NotOpenScreen />;
  const { week } = home;

  const done = week.lessons.filter((l) => l.done).length;
  const next = week.lessons.find((l) => !l.done);
  return (
    <main className={styles.screen}>
      <div className={styles.top}>
        <Link href="/" className={styles.back} aria-label="Back to my plan"><BackIcon /></Link>
        <StarCount value={home.totalStars} />
      </div>

      <header className={styles.head}>
        <div className={styles.headText}>
          <span className={styles.tag} style={{ background: week.done ? 'var(--mint)' : 'var(--yellow-soft)' }}>
            Week {week.number}{week.done ? ' · done' : ''}
          </span>
          <h1 className={styles.title}>{week.skill}</h1>
          <p className={styles.sub}>
            {week.lessons.length === 0 ? 'Lessons are on the way' : week.done ? 'Week done! Play any lesson again for practice.' : `${done} of ${week.lessons.length} lessons done`}
          </p>
        </div>
        <div className={styles.blob}><Blob color={toBlobColor(home.student.blobColor)} mood={week.done ? 'happy' : 'idle'} size="var(--wk-blob, 96px)" /></div>
      </header>

      <ol className={styles.list}>
        {week.lessons.map((l, i) => (
          <li key={l.id}>
            <Link href={`/lesson/${l.id}`} className={`${styles.row} ${l === next ? styles.next : ''}`}>
              <span className={l.done ? styles.numDone : styles.num} aria-hidden="true">
                {l.done ? <CheckIcon size={22} strokeWidth={3} /> : i + 1}
              </span>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{l.title}</span>
                <span className={styles.rowSub}>{l.done ? 'Done · play again' : l === next ? 'Up next' : 'Not started'}</span>
              </span>
              <span className={l === next ? styles.goNext : styles.go} aria-hidden="true"><ArrowIcon size={18} /></span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
