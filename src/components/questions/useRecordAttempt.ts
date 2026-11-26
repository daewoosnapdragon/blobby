'use client';
import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { newId, postWithRetry } from '@/lib/kidApi';
import type { AnsweredQuestion } from './QuestionPlayer';

export type AttemptRes = { starsAwarded: number; studentId: string };

/** A save that still failed after every automatic retry. `retry` resends the SAME body; it resolves true once saved. */
export type FailedSave = { correct: boolean; retry: () => Promise<boolean> };

type Body = { clientAttemptId: string; questionId: string; correct: boolean; context: 'lesson' | 'free'; runId?: string };

/**
 * Saves a first-try answer for lessons and free practice (one copy of the retry, 401 and kid-switch rules).
 * Every write goes to whoever the cookie says NOW; when a response names a different kid than this page was
 * rendered for, the page refreshes so the screen shows that kid too (Review Focus #2). The returned function
 * resolves once the save is settled, so a caller can wait for it; the kid never has to.
 * Retries reuse one clientAttemptId, so a flaky connection can't award twice. When even the last retry fails
 * (no network, or 5xx), `onFailed` gets a retry that resends that same clientAttemptId (idempotent).
 */
export function useRecordAttempt({
  context, studentId, onSignedOut, onSaved, onFailed, runId,
}: {
  context: 'lesson' | 'free';
  /** this lesson or practice run, so the review track can tell which answers belong together */
  runId?: string;
  /** the kid this page was rendered for */
  studentId: string;
  onSignedOut: () => void;
  /** a save went through; `starsAwarded` is the server's answer */
  onSaved?: (res: AttemptRes) => void;
  /** a save failed after every retry */
  onFailed?: (failed: FailedSave) => void;
}): (q: AnsweredQuestion, correct: boolean) => Promise<void> {
  const router = useRouter();
  const current = useRef({ studentId, onSignedOut, onSaved, onFailed });
  current.current = { studentId, onSignedOut, onSaved, onFailed };

  /** One send (with its automatic retries). 'failed' = never reached a working server. */
  const send = useCallback(async (body: Body): Promise<'ok' | 'failed'> => {
    const r = await postWithRetry<AttemptRes>('/api/attempt', body);
    const cur = current.current;
    if (r.status === 0 || r.status >= 500) return 'failed';
    if (r.status === 401) cur.onSignedOut();
    else if (r.status === 404) router.refresh();
    else if (r.status === 200 && r.data) {
      if (r.data.studentId !== cur.studentId) router.refresh();
      else cur.onSaved?.(r.data);
    }
    return 'ok';
  }, [router]);

  return useCallback(async (q, correct) => {
    const body: Body = { clientAttemptId: newId(), questionId: q.id, correct, context, ...(runId ? { runId } : {}) };
    if ((await send(body)) === 'failed') {
      current.current.onFailed?.({ correct, retry: async () => (await send(body)) === 'ok' });
    }
  }, [context, send, runId]);
}
