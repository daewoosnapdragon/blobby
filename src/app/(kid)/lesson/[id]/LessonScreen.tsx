'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LessonData } from '@/lib/db/kid';
import type { Hat } from '@/components/blob/Blob';
import { toBlobColor } from '@/lib/blobColors';
import { newId, postWithRetry } from '@/lib/kidApi';
import { trickyToday } from '@/lib/tricky';
import { lessonOutcome } from '@/lib/lessonOutcome';
import { QuestionPlayer } from '@/components/questions/QuestionPlayer';
import { useRecordAttempt } from '@/components/questions/useRecordAttempt';
import { usePracticePing } from '@/components/usePracticePing';
import { WhoAreYouScreen } from '@/components/ui/KidProblems';
import { LessonDone, type DoneState } from './LessonDone';

type CompleteRes = { starsAwarded: number; weekDone: boolean; totalStars: number; studentId: string };

/**
 * Plays a lesson and saves it. Every write goes to whoever the cookie says NOW (the API reads it per request);
 * when a response names a different kid than this page was rendered for, the page refreshes itself so the
 * screen shows that kid too (Review Focus #2).
 */
export function LessonScreen({ data, hat = null }: { data: LessonData; hat?: Hat | null }) {
  const router = useRouter();
  const latest = useRef(data);
  latest.current = data;
  const [phase, setPhase] = useState<'play' | 'done' | 'signedOut'>('play');
  const [done, setDone] = useState<DoneState>({ kind: 'saving' });
  // One id per play-through of this lesson: its answers update the kid's review track once.
  const [runId] = useState(() => newId());
  const answers = useRef<{ skill: string | null | undefined; right: boolean }[]>([]);
  const skillOf = useRef(new Map(data.questions.map((q) => [q.id, q.skill])));

  usePracticePing();
  const record = useRecordAttempt({
    context: 'lesson',
    studentId: data.student.id,
    onSignedOut: () => setPhase('signedOut'),
    runId,
  });
  const onAnswer: typeof record = (q, correct) => {
    answers.current.push({ skill: skillOf.current.get(q.id), right: correct });
    return record(q, correct);
  };

  async function finish() {
    setPhase('done');
    setDone({ kind: 'saving' });
    const page = latest.current;
    const r = await postWithRetry<CompleteRes>('/api/lesson-complete', { lessonId: page.lesson.id, runId });
    if (r.status === 401) return setPhase('signedOut');
    if (r.status === 404) router.refresh(); // the page re-renders as "not open"
    if (r.status !== 200 || !r.data) return setDone({ kind: 'error' });
    const res = r.data;
    const out = lessonOutcome(
      { studentId: page.student.id, lessonDone: page.lessonDone, weekDone: page.week.done, otherLessonsDone: page.otherLessonsDone },
      res,
    );
    setDone({
      kind: 'saved',
      firstTime: out.firstTime,
      nextHref: out.toWeekDone ? `/week-done/${page.week.id}` : '/',
      starsBefore: res.totalStars - res.starsAwarded,
      starsAfter: res.totalStars,
    });
    if (res.studentId !== page.student.id) router.refresh();
  }

  if (phase === 'signedOut') return <WhoAreYouScreen />;
  if (phase === 'done') {
    return (
      <LessonDone
        state={done}
        name={data.student.displayName}
        color={toBlobColor(data.student.blobColor)}
        stars={data.totalStars}
        onRetry={finish}
        tricky={trickyToday(answers.current)}
      />
    );
  }
  return (
    <QuestionPlayer
      questions={data.questions}
      onAnswer={onAnswer}
      onFinish={finish}
      blobColor={toBlobColor(data.student.blobColor)}
      hat={hat}
      stars={data.totalStars}
      autoRead={data.student.grade <= 2}
    />
  );
}
