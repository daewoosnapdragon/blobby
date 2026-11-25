'use client';
import { useState } from 'react';
import type { LessonQuestion } from '@/lib/db/kid';
import { toBlobColor } from '@/lib/blobColors';
import { STAR_VALUES } from '@/lib/stars';
import { QuestionPlayer } from '@/components/questions/QuestionPlayer';
import { useRecordAttempt } from '@/components/questions/useRecordAttempt';
import { WhoAreYouScreen } from '@/components/ui/KidProblems';
import { PracticeDone } from './PracticeDone';

type Student = { id: string; displayName: string; blobColor: string | null; grade: number; totalStars: number };

/**
 * Free practice: one set of mixed questions with QuestionPlayer (context 'free'). Only the first try at each
 * question is saved, by the same hook lessons use. The star counter and the end summary count what the
 * server said it awarded, never a guess.
 */
export function PracticeScreen({ student, questions }: { student: Student; questions: LessonQuestion[] }) {
  const [phase, setPhase] = useState<'play' | 'done' | 'signedOut'>('play');
  const [earned, setEarned] = useState(0);
  const [saving, setSaving] = useState(0);

  const record = useRecordAttempt({
    context: 'free',
    studentId: student.id,
    onSignedOut: () => setPhase('signedOut'),
    onSaved: (r) => setEarned((n) => n + r.starsAwarded),
  });

  function onAnswer(...args: Parameters<typeof record>) {
    setSaving((n) => n + 1);
    void record(...args).finally(() => setSaving((n) => n - 1));
  }

  if (phase === 'signedOut') return <WhoAreYouScreen />;
  const color = toBlobColor(student.blobColor);
  const stars = student.totalStars + earned;
  if (phase === 'done') {
    return <PracticeDone name={student.displayName} color={color} stars={stars} earned={earned} saving={saving > 0} />;
  }
  return (
    <QuestionPlayer
      questions={questions}
      onAnswer={onAnswer}
      onFinish={() => setPhase('done')}
      blobColor={color}
      stars={stars}
      autoRead={student.grade <= 2}
      answerStars={STAR_VALUES.freeCorrect}
      closeLabel="Close practice"
    />
  );
}
