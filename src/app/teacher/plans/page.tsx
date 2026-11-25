import type { Metadata } from 'next';
import { requireTeacher } from '@/lib/supabase/server';
import { listPlans } from '@/lib/db/teacher';
import { signOut } from '../actions';
import { TeacherShell } from '../views';
import { PlansView } from './PlansView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Plans' };

export default async function PlansPage() {
  await requireTeacher();
  const classes = await listPlans();
  return <TeacherShell signOut={signOut} current="plans"><PlansView classes={classes} /></TeacherShell>;
}
