import type { Metadata } from 'next';
import { requireTeacherUser } from '@/lib/supabase/server';
import { listClasses } from '@/lib/db/teacher';
import { signOut } from './actions';
import { ClassesView, TeacherShell } from './views';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Classes' };

export default async function TeacherHome() {
  const me = await requireTeacherUser();
  const classes = await listClasses();
  return <TeacherShell signOut={signOut} who={me.name ?? me.email} current="classes"><ClassesView classes={classes} /></TeacherShell>;
}
