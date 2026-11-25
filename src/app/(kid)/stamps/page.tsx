import Link from 'next/link';
import { redirect } from 'next/navigation';
import { practicedDays, studentFromRequest } from '@/lib/db/kid';
import { seoulDate } from '@/lib/dates';
import { toBlobColor } from '@/lib/blobColors';
import { canGoNext, dayLabel, monthGrid, monthOf, monthTitle, pickMonth, shiftMonth } from '@/lib/calendar';
import { MiniBlob } from '@/components/blob/MiniBlob';
import { ArrowIcon } from '@/components/ui/icons';
import styles from './stamps.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My stamps · Blobby' };

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function summary(n: number): string {
  if (n === 0) return 'Your first stamp is waiting for you';
  return `You practiced ${n} ${n === 1 ? 'day' : 'days'} this month`;
}

export default async function Stamps({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const student = await studentFromRequest();
  if (!student) redirect('/join');
  if (!student.blob_color) redirect('/pick');

  const today = seoulDate(new Date());
  const current = monthOf(today);
  const month = pickMonth((await searchParams).month, current);
  const practiced = new Set(await practicedDays(student.id, month));
  const color = toBlobColor(student.blob_color);
  const next = canGoNext(month, current);
  const href = (m: string) => (m === current ? '/stamps' : `/stamps?month=${m}`);

  return (
    <main className={styles.screen}>
      <header className={styles.top}>
        <Link href="/" className={styles.back} aria-label="Back home"><span className={styles.flip}><ArrowIcon size={22} /></span></Link>
        <h1 className={styles.title}>My stamps</h1>
      </header>

      <section className={styles.card} aria-labelledby="month-title">
        <div className={styles.nav}>
          <Link href={href(shiftMonth(month, -1))} className={styles.step} aria-label="Previous month"><span className={styles.flip}><ArrowIcon size={20} /></span></Link>
          <h2 id="month-title" className={styles.month}>{monthTitle(month)}</h2>
          {next ? (
            <Link href={href(shiftMonth(month, 1))} className={styles.step} aria-label="Next month"><ArrowIcon size={20} /></Link>
          ) : (
            <span className={`${styles.step} ${styles.stepOff}`} aria-hidden="true" />
          )}
        </div>
        <p className={styles.summary} data-testid="stamp-summary">{summary(practiced.size)}</p>

        <div className={styles.weekdays} aria-hidden="true">
          {WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <ul className={styles.grid}>
          {monthGrid(month).flat().map((d, i) => {
            if (!d) return <li key={`pad${i}`} className={styles.pad} aria-hidden="true" />;
            const did = practiced.has(d);
            return (
              <li
                key={d}
                className={`${styles.day} ${d === today ? styles.today : ''}`}
                aria-label={dayLabel(d, did)}
                aria-current={d === today ? 'date' : undefined}
                data-day={d}
                data-practiced={did ? '' : undefined}
              >
                {did ? <span className={styles.stamp}><MiniBlob color={color} size={44} /></span> : null}
                <span className={did ? styles.numOn : styles.num} aria-hidden="true">{Number(d.slice(8))}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
