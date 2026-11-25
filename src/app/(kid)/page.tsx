// Stub: Task 8 replaces this with the real home screen (and places NotYou in its top bar).
import { redirect } from 'next/navigation';
import { studentFromRequest } from '@/lib/db/kid';
import { NotYou } from '@/components/auth/NotYou';
import styles from './stub.module.css';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const student = await studentFromRequest();
  if (!student) redirect('/join');
  return (
    <main className={styles.stub}>
      <h1>Hi, {student.display_name}!</h1>
      <NotYou />
    </main>
  );
}
