import type { Metadata } from 'next';
import { requireTeacherUser } from '@/lib/supabase/server';
import { listPlans, countMissingAudio } from '@/lib/db/teacher';
import { signOut } from '../actions';
import { TeacherShell } from '../views';
import { PlansView } from './PlansView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Plans' };

export default async function PlansPage() {
  const me = await requireTeacherUser();
  const [classes, missingAudio] = await Promise.all([listPlans(), countMissingAudio()]);
  return <TeacherShell signOut={signOut} who={me.name ?? me.email} current="plans"><PlansView classes={classes} missingAudio={missingAudio} /></TeacherShell>;
}
