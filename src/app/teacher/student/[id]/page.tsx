import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireTeacherUser } from '@/lib/supabase/server';
import { studentDetail, studentSkills } from '@/lib/db/teacher';
import { addStudentSkill, removeStudentSkill, renameStudent, reissueStudentLink, signOut } from '../../actions';
import { ReviewSkills } from '../ReviewSkills';
import { StudentView, TeacherShell } from '../../views';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Student' };

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ name?: string; reissued?: string }> }) {
  const me = await requireTeacherUser();
  const { id } = await params;
  const { name, reissued } = await searchParams;
  const [d, skills] = await Promise.all([studentDetail(id), studentSkills(id)]);
  if (!d) notFound();
  return (
    <TeacherShell signOut={signOut} who={me.name ?? me.email}>
      <StudentView student={d.student} classId={d.classId} className={d.className} history={d.history} renameAction={renameStudent} reissueAction={reissueStudentLink} nameError={name === 'bad'} reissued={reissued === '1'}>
        <ReviewSkills studentId={d.student.id} skills={skills} addAction={addStudentSkill} removeAction={removeStudentSkill} />
      </StudentView>
    </TeacherShell>
  );
}
