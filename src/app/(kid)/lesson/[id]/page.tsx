import { blobScene } from '@/lib/scene';
import { sceneNow } from '@/lib/sceneOverride';
import { redirect } from 'next/navigation';
import { getLesson, NotFoundError, studentFromRequest, type LessonData } from '@/lib/db/kid';
import { NotOpenScreen } from '@/components/ui/KidProblems';
import { LessonScreen } from './LessonScreen';

export const dynamic = 'force-dynamic';

export default async function LessonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
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
  return <LessonScreen data={data} hat={blobScene(sceneNow(sp['scene-date']), 12).hat} />;
}
