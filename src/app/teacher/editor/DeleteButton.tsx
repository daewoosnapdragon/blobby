'use client';
import { useState } from 'react';
import s from './editor.module.css';

/** Delete with a confirm step. Past answers still count; kids just stop seeing the question. */
export function DeleteButton({ action, lessonId, questionId, label }: { action: (fd: FormData) => Promise<void>; lessonId: string; questionId: string; label: string }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return <button type="button" className={s.dangerLink} onClick={() => setAsking(true)} aria-label={`Delete ${label}`}>Delete</button>;
  }
  return (
    <form action={action} className={s.confirm} role="group" aria-label={`Delete ${label}?`}>
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="questionId" value={questionId} />
      <span>Delete this question? Kids won&rsquo;t see it any more. Their past answers still count.</span>
      <button type="submit" className={s.dangerBtn}>Yes, delete</button>
      <button type="button" className={s.linkBtn} onClick={() => setAsking(false)} autoFocus>Keep it</button>
    </form>
  );
}
