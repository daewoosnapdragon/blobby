'use client';
import { useEffect, useMemo, useState } from 'react';
import { QuestionPlayer, type PlayerQuestion } from '@/components/questions/QuestionPlayer';
import type { NonWatchQuestion } from '@/lib/questions/schema';

/** Lives inside the editor's preview iframe: shows whatever the editor last posted. No data is saved. */
export function PreviewFrame() {
  const [questions, setQuestions] = useState<NonWatchQuestion[]>([]);
  const [round, setRound] = useState(0);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.kind !== 'blobby-preview' || !Array.isArray(e.data.questions)) return;
      setQuestions(e.data.questions as NonWatchQuestion[]);
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ kind: 'blobby-preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const key = JSON.stringify(questions);
  const list: PlayerQuestion[] = useMemo(() => questions.map((question, i) => ({ id: `preview-${i}`, question })), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (list.length === 0) {
    return <p style={{ margin: 0, padding: 24, color: 'var(--muted)', textAlign: 'center', fontWeight: 700 }}>Fill in the form to see the question.</p>;
  }
  return (
    <QuestionPlayer key={`${round}:${key}`} questions={list} onAnswer={() => {}} onFinish={() => setRound((r) => r + 1)} blobColor="mint" stars={0} bare />
  );
}
