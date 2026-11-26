import Link from 'next/link';
import type { EditorLesson } from '@/lib/db/teacher';
import { draftFromQuestion, emptyDraft, TYPE_NAMES } from '@/lib/questions/draft';
import { QUESTION_TYPES, isQuestionType, type QuestionType } from '@/lib/questions/schema';
import { BackIcon } from '@/components/ui/icons';
import { deleteQuestionAction } from '../editorActions';
import { DeleteButton } from './DeleteButton';
import { QuestionForm } from './QuestionForm';
import { QuestionAnswers } from './QuestionAnswers';
import t from '../teacher.module.css';
import s from './editor.module.css';

export type EditorBanner = 'saved' | 'noaudio' | 'deleted' | 'last' | null;

/** Read-aloud is paused for now (Kyla, Nov 26): no per-question audio warnings. Set true when audio is back. */
const SHOW_AUDIO_STATUS = false;

export function EditorView({ data, edit, add, banner, previewSrc }: {
  data: EditorLesson;
  /** id of the question being edited */
  edit?: string;
  /** type of the question being added */
  add?: string;
  banner?: EditorBanner;
  previewSrc?: string;
}) {
  const base = `/teacher/editor/${data.lesson.id}`;
  const editing = edit ? data.questions.find((q) => q.id === edit && q.question) : undefined;
  const adding: QuestionType | undefined = !editing && add && isQuestionType(add) ? add : undefined;
  const nextPosition = data.questions.reduce((m, q) => Math.max(m, q.position), 0) + 1;

  return (
    <>
      <Link href="/teacher/plans" className={t.back}><BackIcon size={18} /> Plans</Link>
      <h1 className={t.h1}>{data.lesson.title}</h1>
      <p className={t.sub}>{data.plan.title} · Week {data.week.position}: {data.week.skill}</p>

      <div role="status" aria-live="polite">
        {banner === 'saved' ? <p className={`${s.banner} ${s.ok}`}>Saved. Audio is ready.</p> : null}
        {banner === 'noaudio' ? (SHOW_AUDIO_STATUS
          ? <p className={`${s.banner} ${s.warn}`}>Saved. Audio couldn&rsquo;t be made, so Hear it will be quiet for this question.</p>
          : <p className={`${s.banner} ${s.ok}`}>Saved.</p>) : null}
        {banner === 'last' ? <p className={`${s.banner} ${s.warn}`}>A lesson needs at least one question. Add another one first, then delete this one.</p> : null}
        {banner === 'deleted' ? <p className={`${s.banner} ${s.ok}`}>Deleted. Kids won&rsquo;t see it any more.</p> : null}
      </div>

      <section className={t.card} aria-labelledby="qlist">
        <h2 id="qlist" className={t.h2}>Questions ({data.questions.length})</h2>
        {data.questions.length === 0 ? <p className={t.empty}>No questions yet. Add the first one below.</p> : (
          <ol className={s.qGrid}>
            {data.questions.map((q, i) => (
              <li key={q.id} className={s.qCard} data-active={editing?.id === q.id ? '' : undefined}>
                <div className={s.qHead}>
                  <span className={s.qNum}>{i + 1}</span>
                  <span className={s.typeTag}>{isQuestionType(q.type) ? TYPE_NAMES[q.type] : q.type}</span>
                  <span className={s.qActions}>
                    {q.question ? <Link href={`${base}?edit=${q.id}#form`} className={s.editLink} aria-label={`Edit question ${i + 1}`}>Edit</Link> : null}
                    <DeleteButton action={deleteQuestionAction} lessonId={data.lesson.id} questionId={q.id} label={`question ${i + 1}`} />
                  </span>
                </div>
                <div className={s.qBody}>
                  {q.question ? <QuestionAnswers question={q.question} />
                    : <p className={`${s.qText} ${s.broken}`}>This question has a problem and kids skip it. Delete it and add it again.</p>}
                  {SHOW_AUDIO_STATUS && q.audioMissing ? <span className={s.noAudio}>No audio yet. Open Edit and save again to try.</span> : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={s.addSection} aria-labelledby="add-title">
        <h2 id="add-title" className={t.h2}>Add a question</h2>
        <ul className={s.typePicker}>
          {QUESTION_TYPES.map((type) => (
            <li key={type}>
              <Link href={`${base}?add=${type}#form`} className={s.typeBtn} aria-current={adding === type ? 'true' : undefined}>{TYPE_NAMES[type]}</Link>
            </li>
          ))}
        </ul>
      </section>

      <div id="form" className={s.formAnchor}>
        {editing?.question ? (
          <QuestionForm key={`${editing.id}`} lessonId={data.lesson.id} questionId={editing.id} position={editing.position} initial={draftFromQuestion(editing.question)} isNew={false} cancelHref={base} previewSrc={previewSrc} />
        ) : adding ? (
          <QuestionForm key={`new-${adding}`} lessonId={data.lesson.id} position={nextPosition} initial={emptyDraft(adding)} isNew cancelHref={base} previewSrc={previewSrc} />
        ) : null}
      </div>
    </>
  );
}
