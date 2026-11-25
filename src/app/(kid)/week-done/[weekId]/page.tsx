import { redirect } from 'next/navigation';
import { getWeekDone, NotFoundError, studentFromRequest, type WeekDoneData } from '@/lib/db/kid';
import { toBlobColor } from '@/lib/blobColors';
import { NotOpenScreen } from '@/components/ui/KidProblems';
import { WeekDone } from './WeekDone';

export const dynamic = 'force-dynamic';

export default async function WeekDonePage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const student = await studentFromRequest();
  if (!student) redirect('/join');
  let data: WeekDoneData;
  try {
    data = await getWeekDone(student.id, weekId);
  } catch (e) {
    if (e instanceof NotFoundError) return <NotOpenScreen />;
    throw e;
  }
  if (!data.week.done) redirect(`/week/${weekId}`);
  return (
    <WeekDone
      number={data.week.number}
      skill={data.week.skill}
      weekStars={data.weekStars}
      totalStars={data.totalStars}
      color={toBlobColor(data.student.blobColor)}
    />
  );
}
