'use client';
import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { newId, postWithRetry } from '@/lib/kidApi';
import type { AnsweredQuestion } from './QuestionPlayer';

export type AttemptRes = { starsAwarded: number; studentId: string };

/**
 * Saves a first-try answer for lessons and free practice (one copy of the retry, 401 and kid-switch rules).
 * Every write goes to whoever the cookie says NOW; when a response names a different kid than this page was
 * rendered for, the page refreshes so the screen shows that kid too (Review Focus #2). The returned function
 * resolves once the save is settled, so a caller can wait for it; the kid never has to.
 * Retries reuse one clientAttemptId, so a flaky connection can't award twice.
 */
export function useRecordAttempt({
  context, studentId, onSignedOut, onSaved,
}: {
  context: 'lesson' | 'free';
  /** the kid this page was rendered for */
  studentId: string;
  onSignedOut: () => void;
  /** a save went through; `starsAwarded` is the server's answer */
  onSaved?: (res: AttemptRes) => void;
}): (q: AnsweredQuestion, correct: boolean) => Promise<void> {
  const router = useRouter();
  const current = useRef({ studentId, onSignedOut, onSaved });
  current.current = { studentId, onSignedOut, onSaved };

  return useCallback(async (q, correct) => {
    const r = await postWithRetry<AttemptRes>('/api/attempt', { clientAttemptId: newId(), questionId: q.id, correct, context });
    const cur = current.current;
    if (r.status === 401) cur.onSignedOut();
    else if (r.status === 404) router.refresh();
    else if (r.status === 200 && r.data) {
      if (r.data.studentId !== cur.studentId) router.refresh();
      else cur.onSaved?.(r.data);
    }
  }, [context, router]);
}
