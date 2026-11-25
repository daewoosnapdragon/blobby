import { redirect } from 'next/navigation';
import { getLesson, NotFoundError, studentFromRequest, type LessonData } from '@/lib/db/kid';
import { NotOpenScreen } from '@/components/ui/KidProblems';
import { LessonScreen } from './LessonScreen';

export const dynamic = 'force-dynamic';

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Read on every request: after "Not you?" a refresh of this page must show the new kid (Review Focus #2).
  const student = await studentFromRequest();
  if (!student) redirect('/join');
  let data: LessonData;
  try {
    data = await getLesson(student.id, id);
  } catch (e) {
    if (e instanceof NotFoundError) return <NotOpenScreen />;
    throw e;
  }
  if (data.questions.length === 0) return <NotOpenScreen />;
  return <LessonScreen data={data} />;
}
