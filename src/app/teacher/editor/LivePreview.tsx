'use client';
import { useEffect, useRef } from 'react';
import type { NonWatchQuestion } from '@/lib/questions/schema';
import s from './editor.module.css';

export const PREVIEW_MESSAGE = 'blobby-preview';

/**
 * The question as a kid sees it, in a phone-sized frame. It is a page of its own so the kid components lay out for a
 * 390px screen no matter how wide the editor is. The editor posts the current valid questions to it on every change.
 */
export function LivePreview({ questions, src = '/teacher/editor/preview', note }: { questions: NonWatchQuestion[]; src?: string; note?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef(questions);
  latest.current = questions;

  function send() {
    frame.current?.contentWindow?.postMessage({ kind: PREVIEW_MESSAGE, questions: latest.current }, window.location.origin);
  }
  useEffect(send, [questions]);
  useEffect(() => {
    const ask = (e: MessageEvent) => { if (e.origin === window.location.origin && e.data?.kind === 'blobby-preview-ready') send(); };
    window.addEventListener('message', ask);
    return () => window.removeEventListener('message', ask);
  }, []);

  return (
    <aside className={s.preview} aria-label="Preview">
      <h2 className={s.previewTitle}>Preview</h2>
      <p className={s.hint}>Tap the answers like a kid would. {note ?? ''} Hear it works after you save.</p>
      <iframe ref={frame} src={src} title="How kids will see this question" className={s.frame} onLoad={send} />
      {questions.length === 0 ? <p className={s.hint}>The preview fills in as the question becomes complete.</p> : null}
    </aside>
  );
}
