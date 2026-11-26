import { redirect } from 'next/navigation';
import { getPracticeSet, getPracticeStudent, getSkillPractice, practiceAvailable, studentFromRequest } from '@/lib/db/kid';
import { isSkillKey } from '@/lib/skills';
import { toBlobColor } from '@/lib/blobColors';
import { ProblemScreen } from '@/components/ui/ProblemScreen';
import { PillButton } from '@/components/ui/PillButton';
import { koKid } from '@/lib/copy.ko';
import { PracticeScreen } from './PracticeScreen';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Free practice · Blobby' };

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ skill?: string }> }) {
  // Read on every request so "Not you?" followed by a refresh shows the new kid (Review Focus #2).
  const student = await studentFromRequest();
  if (!student) redirect('/join');
  if (!student.blob_color) redirect('/pick');
  // ?skill=<key>: "Practice again" from Tricky today, 5 questions on that one skill.
  const skill = (await searchParams).skill;
  // Practice opens with the first week, for one skill too (the review bank alone doesn't open it).
  const [kid, open] = await Promise.all([getPracticeStudent(student.id), practiceAvailable(student.id)]);
  const questions = !open ? [] : isSkillKey(skill) ? await getSkillPractice(student.id, skill) : await getPracticeSet(student.id);

  if (questions.length === 0) {
    return (
      <ProblemScreen
        title="Nothing to practice yet"
        message="Free practice opens when your first week does."
        parentNote={koKid.noPractice}
        color={toBlobColor(kid.blobColor)}
        action={<PillButton href="/">Back to my plan</PillButton>}
      />
    );
  }
  // A new key per render: "Practice again" refreshes this page and the screen starts over with the new set.
  return <PracticeScreen key={crypto.randomUUID()} student={kid} questions={questions} />;
}
