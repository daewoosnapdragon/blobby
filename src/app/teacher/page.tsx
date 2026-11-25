import type { Metadata } from 'next';
import { requireTeacher } from '@/lib/supabase/server';
import { listClasses } from '@/lib/db/teacher';
import { signOut } from './actions';
import { ClassesView, TeacherShell } from './views';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Classes' };

export default async function TeacherHome() {
  await requireTeacher();
  const classes = await listClasses();
  return <TeacherShell signOut={signOut}><ClassesView classes={classes} /></TeacherShell>;
}
