import Link from 'next/link';
import { ReissueButton } from './ReissueButton';
import { Blob, BLOB_HEX, type BlobColor } from '@/components/blob/Blob';
import { BackIcon, StarIcon } from '@/components/ui/icons';
import { toBlobColor } from '@/lib/blobColors';
import { formatDuration, type StudentStats } from '@/lib/stats';
import type { ClassCard } from '@/lib/db/teacher';
import styles from './teacher.module.css';

/** Presentational pieces for the teacher pages. Data in, markup out; the pages own auth and queries. */

export function TeacherShell({ children, signOut, current, who }: { children: React.ReactNode; signOut?: () => Promise<void>; current?: 'classes' | 'plans' | 'account'; who?: string }) {
  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <Link href="/teacher" className={styles.brand}>Blobby <span>teacher</span></Link>
        {signOut ? (
          <nav className={styles.nav} aria-label="Teacher">
            <Link href="/teacher" aria-current={current === 'classes' ? 'page' : undefined}>Classes</Link>
            <Link href="/teacher/plans" aria-current={current === 'plans' ? 'page' : undefined}>Plans</Link>
            <Link href="/teacher/account" aria-current={current === 'account' ? 'page' : undefined}>Account</Link>
          </nav>
        ) : null}
        {signOut ? (
          <div className={styles.who}>
            {who ? <span className={styles.hi}>Hi, {who}</span> : null}
            <form action={signOut}><button type="submit" className={styles.ghost}>Sign out</button></form>
          </div>
        ) : null}
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

/** The kid's blob in their color, or a neutral gray blob before they have picked one. */
export function KidBlob({ color, size = 40 }: { color: string | null; size?: number }) {
  if (!color) return <GrayBlob size={size} />;
  return <Blob color={toBlobColor(color) as BlobColor} mood="happy" size={size} />;
}

function GrayBlob({ size }: { size: number }) {
  return (
    <svg width={size} height={(size * 112) / 120} viewBox="0 0 120 112" aria-hidden="true" data-testid="gray-blob">
      <path d="M58 8 C84 2 112 18 114 48 C116 78 98 104 64 106 C30 108 4 88 6 58 C8 30 30 14 58 8 Z" fill="#D8D3CD" />
      <path d="M43 52 q7 -9 14 0 M63 50 q7 -9 14 0" stroke="#1F1F1F" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M52 66 q8 7 16 0" stroke="#1F1F1F" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function ClassesView({ classes }: { classes: ClassCard[] }) {
  return (
    <>
      <h1 className={styles.h1}>Your classes</h1>
      {classes.length === 0 ? (
        <p className={styles.empty}>No classes yet. Import the roster to get started.</p>
      ) : (
        <ul className={styles.classGrid}>
          {classes.map((c) => (
            <li key={c.id}>
              <Link href={`/teacher/class/${c.id}`} className={styles.classCard}>
                <span className={styles.classTop}>
                  <span className={styles.className}>{c.name}</span>
                  <span className={styles.code}>Code {c.classCode}</span>
                </span>
                <span className={styles.classNums}>
                  <span><b>{c.kidCount}</b> {c.kidCount === 1 ? 'kid' : 'kids'}</span>
                  <span className={styles.starNum}><StarIcon size={20} /><b>{c.totalStars}</b> stars</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export type SortKey = 'name' | 'stars';

export function ClassListView({ classId, className, classCode, rows, sort }: { classId: string; className: string; classCode: string; rows: StudentStats[]; sort: SortKey }) {
  const sorted = [...rows].sort((a, b) =>
    sort === 'stars' ? b.stars - a.stars || a.displayName.localeCompare(b.displayName) : a.displayName.localeCompare(b.displayName));
  const total = rows.reduce((n, r) => n + r.stars, 0);
  return (
    <>
      <Link href="/teacher" className={styles.back}><BackIcon size={18} /> All classes</Link>
      <div className={styles.titleRow}>
        <h1 className={styles.h1}>{className}</h1>
        <span className={styles.code}>Code {classCode}</span>
        <Link href={`/teacher/class/${classId}/cards`} className={styles.ghost} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Print cards</Link>
      </div>
      <p className={styles.sub}>{rows.length} {rows.length === 1 ? 'kid' : 'kids'} · {total} stars in all</p>
      {rows.length === 0 ? (
        <p className={styles.empty}>No kids in this class yet.</p>
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.scroll} tabIndex={0} role="region" aria-label={`${className} students`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col" className={styles.left}>
                    {sort === 'name' ? 'Name' : <Link href="?sort=name">Name</Link>}
                  </th>
                  <th scope="col" className={styles.num}>
                    {sort === 'stars' ? 'Stars' : <Link href="?sort=stars">Stars</Link>}
                  </th>
                  <th scope="col" className={styles.num}>Days</th>
                  <th scope="col" className={styles.num}>Time</th>
                  <th scope="col" className={styles.num}>Weeks done</th>
                  <th scope="col" className={styles.left}>Last skill</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.studentId}>
                    <th scope="row" className={styles.left}>
                      <Link href={`/teacher/student/${r.studentId}`} className={styles.kid}>
                        <KidBlob color={r.blobColor} size={40} />
                        <span>{r.displayName}</span>
                      </Link>
                    </th>
                    <td className={styles.num}>{r.stars}</td>
                    <td className={styles.num}>{r.daysPracticed}</td>
                    <td className={styles.num}>{formatDuration(r.secondsPracticed)}</td>
                    <td className={styles.num}>{r.weeksDone}</td>
                    <td className={styles.left}>{r.lastSkill ?? <span className={styles.none}>Not yet</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.tableNote}>Days and time include the in-class test weeks.</p>
        </div>
      )}
    </>
  );
}

/** "Mon, Dec 21" from a YYYY-MM-DD string, with no time-zone shift. */
export function niceDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function StudentView({
  student, classId, className, history, renameAction, reissueAction, nameError, reissued,
}: {
  student: { id: string; displayName: string; blobColor: string | null };
  classId: string; className: string;
  history: { skill: string; dates: string[] }[];
  renameAction: (formData: FormData) => Promise<void>;
  reissueAction: (formData: FormData) => Promise<void>;
  nameError?: boolean;
  reissued?: boolean;
}) {
  return (
    <>
      <Link href={`/teacher/class/${classId}`} className={styles.back}><BackIcon size={18} /> {className}</Link>
      <div className={styles.studentHead}>
        <span className={styles.bigBlob}><KidBlob color={student.blobColor} size={88} /></span>
        <div className={styles.nameBlock}>
          <h1 className={styles.h1}>{student.displayName}</h1>
          <form action={renameAction} className={styles.rename}>
            <input type="hidden" name="studentId" value={student.id} />
            <label htmlFor="display-name">Display name</label>
            <div className={styles.renameRow}>
              <input id="display-name" name="name" defaultValue={student.displayName} maxLength={40} required autoComplete="off" aria-describedby={nameError ? 'name-error' : undefined} />
              <button type="submit" className={styles.solid}>Save name</button>
            </div>
            {nameError ? <p id="name-error" role="alert" className={styles.error}>Use 1 to 40 characters.</p> : null}
          </form>
        </div>
      </div>

      <section className={styles.card} aria-labelledby="card-link">
        <h2 id="card-link" className={styles.h2}>QR card</h2>
        {reissued ? (
          <p role="status" className={styles.okNote}>
            New card link made. The old card has stopped working.{' '}
            <Link href={`/teacher/class/${classId}/cards?student=${student.id}`}>Print {student.displayName}&apos;s new card</Link>
          </p>
        ) : null}
        <form action={reissueAction} className={styles.reissue}>
          <input type="hidden" name="studentId" value={student.id} />
          <ReissueButton />
        </form>
        <p className={styles.hint}>Lost card? Make a new link. The old card will stop working. Devices already signed in stay signed in.</p>
      </section>

      <section className={styles.card} aria-labelledby="skills">
        <h2 id="skills" className={styles.h2}>Skills practiced</h2>
        {history.length === 0 ? (
          <p className={styles.empty}>Nothing practiced yet.</p>
        ) : (
          <ul className={styles.skills}>
            {history.map((h) => (
              <li key={h.skill}>
                <span className={styles.skillName}>{h.skill}</span>
                <span className={styles.dates}>{h.dates.map((d) => <time key={d} dateTime={d}>{niceDate(d)}</time>)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
