import type { NonWatchQuestion, Question } from '@/lib/questions/schema';
import { pictureSrc } from '@/lib/pictures';
import s from './editor.module.css';

/** The right answer, marked in color and for screen readers. */
function Right({ children }: { children: React.ReactNode }) {
  return <span className={s.right}><span className={s.srOnly}>right answer: </span>{children}</span>;
}

function Others({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return <p className={s.others}>{label} {items.join(', ')}</p>;
}

function Body({ question: q }: { question: NonWatchQuestion }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {q.picture ? <img src={pictureSrc(q.picture)} alt={`Picture: ${q.picture.replace(/-/g, ' ')}`} width={48} height={48} className={s.qPic} /> : null}
      <BodyText question={q} />
    </>
  );
}

function BodyText({ question: q }: { question: NonWatchQuestion }) {
  switch (q.type) {
    case 'pick_one':
    case 'listen_tap':
      return (
        <>
          <p className={s.prompt}>{q.prompt}</p>
          {q.type === 'listen_tap' ? <p className={s.others}>Says: &ldquo;{q.audioText}&rdquo;</p> : null}
          <ul className={s.choices}>
            {q.choices.map((c, i) => {
              const text = typeof c === 'string' ? c : c.text;
              return <li key={i} className={i === q.answer ? s.choiceRight : s.choice}>{i === q.answer ? <Right>{text}</Right> : text}</li>;
            })}
          </ul>
        </>
      );
    case 'fill_blank':
      return (
        <>
          <p className={s.sentence}>{q.before} <Right>{q.choices[q.answer]}</Right> {q.after}</p>
          <Others label="Other choices:" items={q.choices.filter((_, i) => i !== q.answer)} />
        </>
      );
    case 'find_fix':
      return (
        <>
          <p className={s.sentence}>
            {q.words.map((w, i) => (
              <span key={i}>{i > 0 ? ' ' : ''}{i === q.wrongIndex ? <><del className={s.wrong}>{w}</del> <Right>{q.fixes[q.answer]}</Right></> : w}</span>
            ))}
          </p>
          <Others label="Other fixes:" items={q.fixes.filter((_, i) => i !== q.answer)} />
        </>
      );
    case 'build_it':
      return (
        <>
          <p className={s.prompt}>{q.prompt}</p>
          <p className={s.sentence}><Right>{q.tiles.join(' ')}</Right></p>
          <Others label="Extra tiles:" items={q.distractors ?? []} />
        </>
      );
    case 'sort_it':
      return (
        <>
          <p className={s.prompt}>{q.prompt}</p>
          <div className={s.groups}>
            {q.groups.map((g, gi) => (
              <div key={gi} className={s.group}>
                <span className={s.groupName} id={undefined}>{g}</span>
                <ul aria-label={g} className={s.groupItems}>
                  {q.items.filter((it) => it.group === gi).map((it, i) => <li key={i}>{it.text}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </>
      );
    case 'right_wrong':
      return (
        <>
          <p className={s.sentence}>{q.sentence}</p>
          <p className={s.others}>{q.right ? <Right>Right</Right> : 'Not right'}</p>
        </>
      );
    case 'odd_one_out':
      return (
        <>
          <p className={s.prompt}>{q.prompt}</p>
          <ul className={s.choices}>
            {q.words.map((w, i) => <li key={i} className={i === q.answer ? s.choiceRight : s.choice}>{i === q.answer ? <Right>{w}</Right> : w}</li>)}
          </ul>
        </>
      );
    case 'picture_first':
      return (
        <>
          <p className={s.prompt}>{q.prompt}</p>
          <ul className={s.choices}>
            {q.choices.map((c, i) => <li key={i} className={i === q.answer ? s.choiceRight : s.choice}>{i === q.answer ? <Right>{c}</Right> : c}</li>)}
          </ul>
        </>
      );
  }
}

/** A whole question as the teacher should check it: the prompt, every option, and the right answer marked. */
export function QuestionAnswers({ question: q }: { question: Question }) {
  if (q.type === 'watch_answer') {
    return (
      <>
        <p className={s.others}>Video (YouTube {q.youtubeId}), then {q.questions.length} {q.questions.length === 1 ? 'question' : 'questions'}:</p>
        <ol className={s.subQuestions}>
          {q.questions.map((sub, i) => <li key={i}><Body question={sub} /></li>)}
        </ol>
      </>
    );
  }
  return <Body question={q} />;
}
