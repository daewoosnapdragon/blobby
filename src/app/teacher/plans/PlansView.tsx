import Link from 'next/link';
import type { PlansForClass } from '@/lib/db/teacher';
import { WeekForm } from './WeekForm';
import t from '../teacher.module.css';
import s from './plans.module.css';

export function PlansView({ classes }: { classes: PlansForClass[] }) {
  return (
    <>
      <h1 className={t.h1}>Plans</h1>
      <p className={t.sub}>Each week opens on its date (Seoul time). Open a lesson to edit its questions.</p>
      {classes.length === 0 ? <p className={t.empty}>No classes yet. Import the roster to get started.</p> : null}
      {classes.map((c) => (
        <section key={c.id} className={s.classBlock} aria-labelledby={`class-${c.id}`}>
          <h2 id={`class-${c.id}`} className={t.h2}>{c.name}</h2>
          {c.plans.length === 0 ? <p className={t.empty}>No plan is assigned to this class yet.</p> : null}
          {c.plans.map((p) => (
            <div key={p.id} className={t.card}>
              <h3 className={s.planTitle}>{p.title}</h3>
              <ol className={s.weeks}>
                {p.weeks.map((w) => (
                  <li key={w.id} className={s.week}>
                    <WeekForm weekId={w.id} number={w.position} skill={w.skill} opensOn={w.opensOn ?? ''} />
                    <ul className={s.lessons}>
                      {w.lessons.map((l) => (
                        <li key={l.id}>
                          <Link href={`/teacher/editor/${l.id}`} className={s.lesson}>
                            <span className={s.lessonTitle}>{l.title}</span>
                            <span className={s.count}>{l.questionCount} {l.questionCount === 1 ? 'question' : 'questions'}</span>
                            <span className={s.edit}>Edit questions</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
