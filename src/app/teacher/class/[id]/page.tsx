import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireTeacher } from '@/lib/supabase/server';
import { classStats } from '@/lib/db/teacher';
import { signOut } from '../../actions';
import { ClassListView, TeacherShell } from '../../views';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Class' };

export default async function ClassPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sort?: string }> }) {
  await requireTeacher();
  const { id } = await params;
  const { sort } = await searchParams;
  const view = await classStats(id);
  if (!view) notFound();
  return (
    <TeacherShell signOut={signOut}>
      <ClassListView classId={id} className={view.className} classCode={view.classCode} rows={view.rows} sort={sort === 'stars' ? 'stars' : 'name'} />
    </TeacherShell>
  );
}
