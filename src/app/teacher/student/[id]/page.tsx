import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireTeacher } from '@/lib/supabase/server';
import { studentDetail } from '@/lib/db/teacher';
import { renameStudent, signOut } from '../../actions';
import { StudentView, TeacherShell } from '../../views';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Student' };

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ name?: string }> }) {
  await requireTeacher();
  const { id } = await params;
  const { name } = await searchParams;
  const d = await studentDetail(id);
  if (!d) notFound();
  return (
    <TeacherShell signOut={signOut}>
      <StudentView student={d.student} classId={d.classId} className={d.className} history={d.history} renameAction={renameStudent} nameError={name === 'bad'} />
    </TeacherShell>
  );
}
