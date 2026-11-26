'use client';
import { useState } from 'react';
import type { LessonQuestion } from '@/lib/db/kid';
import { toBlobColor } from '@/lib/blobColors';
import { STAR_VALUES } from '@/lib/stars';
import type { Tally } from '@/lib/tally';
import { QuestionPlayer } from '@/components/questions/QuestionPlayer';
import { useRecordAttempt, type FailedSave } from '@/components/questions/useRecordAttempt';
import { SaveRetry } from '@/components/questions/SaveRetry';
import { usePracticePing } from '@/components/usePracticePing';
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
  const [tally, setTally] = useState<Tally | null>(null);
  const [saving, setSaving] = useState(0);
  // First-try right answers whose save failed after every retry ("+1 star" already showed): tap to resend.
  const [failed, setFailed] = useState<FailedSave[]>([]);
  const [retrying, setRetrying] = useState(false);

  usePracticePing();
  const record = useRecordAttempt({
    context: 'free',
    studentId: student.id,
    onSignedOut: () => setPhase('signedOut'),
    onSaved: (r) => setEarned((n) => n + r.starsAwarded),
    onFailed: (f) => { if (f.correct) setFailed((list) => [...list, f]); },
  });

  async function retryFailed() {
    setRetrying(true);
    const results = await Promise.all(failed.map(async (f) => ((await f.retry()) ? null : f)));
    const stillFailed = results.filter((f): f is FailedSave => f !== null);
    setFailed((list) => [...stillFailed, ...list.filter((f) => !failed.includes(f))]);
    setRetrying(false);
  }
  const retryNote = <SaveRetry failed={failed} onRetry={() => void retryFailed()} busy={retrying} />;

  function onAnswer(...args: Parameters<typeof record>) {
    setSaving((n) => n + 1);
    void record(...args).finally(() => setSaving((n) => n - 1));
  }

  if (phase === 'signedOut') return <WhoAreYouScreen />;
  const color = toBlobColor(student.blobColor);
  const stars = student.totalStars + earned;
  if (phase === 'done') {
    return (
      <>
        <PracticeDone name={student.displayName} color={color} stars={stars} earned={earned} saving={saving > 0 || retrying} tally={tally} />
        {retryNote}
      </>
    );
  }
  return (
    <>
      <QuestionPlayer
        questions={questions}
        onAnswer={onAnswer}
        onFinish={(t) => { setTally(t); setPhase('done'); }}
        blobColor={color}
        stars={stars}
        autoRead={student.grade <= 2}
        answerStars={STAR_VALUES.freeCorrect}
        bonusStars={STAR_VALUES.freeBonus}
        closeLabel="Close practice"
      />
      {retryNote}
    </>
  );
}
