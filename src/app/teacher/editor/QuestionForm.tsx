'use client';
import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';
import { draftToPayload, draftWords, emptyDraft, TYPE_NAMES, type Draft, type NonWatchDraft } from '@/lib/questions/draft';
import { parseQuestion, type NonWatchQuestion } from '@/lib/questions/schema';
import { saveQuestionAction } from '../editorActions';
import { TextField } from './fields';
import { TypeForm } from './TypeForms';
import { LivePreview } from './LivePreview';
import { PicturePicker } from './PicturePicker';
import t from '../teacher.module.css';
import s from './editor.module.css';

const INNER_TYPES: NonWatchDraft['type'][] = ['pick_one', 'fill_blank', 'find_fix', 'build_it', 'sort_it', 'listen_tap', 'right_wrong', 'odd_one_out', 'picture_first', 'tap_all', 'match_pairs'];

/** The questions the preview can show right now: every part that is already valid. */
function previewQuestions(d: Draft): NonWatchQuestion[] {
  const drafts: Draft[] = d.type === 'watch_answer' ? d.questions : [d];
  const out: NonWatchQuestion[] = [];
  for (const x of drafts) {
    try {
      const q = parseQuestion(x.type, draftToPayload(x));
      if (q.type !== 'watch_answer') out.push(q);
    } catch { /* not valid yet: leave it out */ }
  }
  return out;
}

export function QuestionForm({ lessonId, questionId, position, initial, isNew, cancelHref, previewSrc }: {
  lessonId: string; /** the question being edited; none when adding */ questionId?: string; /** shown in the title only */ position: number; initial: Draft; isNew: boolean; cancelHref: string; previewSrc?: string;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [state, action, pending] = useActionState(saveQuestionAction, null);
  const questions = useMemo(() => previewQuestions(draft), [draft]);

  return (
    <div className={s.workspace}>
      <form action={action} className={`${t.card} ${s.form}`} aria-labelledby="form-title">
        <input type="hidden" name="lessonId" value={lessonId} />
        <input type="hidden" name="questionId" value={questionId ?? ''} />
        <input type="hidden" name="type" value={draft.type} />
        <input type="hidden" name="draft" value={JSON.stringify(draft)} />
        <h2 id="form-title" className={t.h2}>{isNew ? 'New question' : `Edit question ${position}`}: {TYPE_NAMES[draft.type].toLowerCase()}</h2>

        {draft.type === 'watch_answer' ? (
          <>
            <TextField label="YouTube link" hint="Paste the link or the video id. Blobby checks the video can be played inside the app when you save."
              value={draft.video} onChange={(video) => setDraft({ ...draft, video })} placeholder="https://www.youtube.com/watch?v=…" />
            <div className={s.inner}>
              <h3 className={s.h3}>Questions after the video</h3>
              {draft.questions.map((q, i) => (
                <fieldset key={i} className={s.innerCard}>
                  <legend>Question {i + 1}</legend>
                  <div className={s.innerHead}>
                    <label className={s.innerType}>
                      <span>Type</span>
                      <select className={s.select} value={q.type} onChange={(e) => setDraft({ ...draft, questions: draft.questions.map((x, j) => (j === i ? (emptyDraft(e.target.value as NonWatchDraft['type']) as NonWatchDraft) : x)) })}>
                        {INNER_TYPES.map((k) => <option key={k} value={k}>{TYPE_NAMES[k]}</option>)}
                      </select>
                    </label>
                    <button type="button" className={s.linkBtn} disabled={draft.questions.length <= 1}
                      onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, j) => j !== i) })}>Remove question {i + 1}</button>
                  </div>
                  <TypeForm draft={q} onChange={(next) => setDraft({ ...draft, questions: draft.questions.map((x, j) => (j === i ? next : x)) })} />
                  <PicturePicker text={draftWords(q)} value={q.picture ?? ''} required={q.type === 'picture_first'}
                    onChange={(picture) => setDraft({ ...draft, questions: draft.questions.map((x, j) => (j === i ? { ...x, picture } : x)) })} />
                </fieldset>
              ))}
              <button type="button" className={s.addBtn} disabled={draft.questions.length >= 6}
                onClick={() => setDraft({ ...draft, questions: [...draft.questions, emptyDraft('pick_one')] })}>+ Add a question</button>
            </div>
          </>
        ) : (
          <>
            <TypeForm draft={draft} onChange={setDraft} />
            <PicturePicker text={draftWords(draft)} value={draft.picture ?? ''} required={draft.type === 'picture_first'} onChange={(picture) => setDraft({ ...draft, picture })} />
          </>
        )}

        <div role="alert" className={s.problemsBox} hidden={!state || state.ok}>
          {state && !state.ok ? (
            <>
              <strong>Not saved yet. Fix this:</strong>
              <ul>{state.problems.map((p) => <li key={p}>{p}</li>)}</ul>
            </>
          ) : null}
        </div>

        <div className={s.actions}>
          <button type="submit" className={t.solid} disabled={pending}>{pending ? 'Saving…' : 'Save question'}</button>
          <Link href={cancelHref} className={t.ghost} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Cancel</Link>
        </div>
      </form>

      <LivePreview questions={questions} src={previewSrc} note={draft.type === 'watch_answer' ? 'The video step is skipped here.' : undefined} />
    </div>
  );
}
