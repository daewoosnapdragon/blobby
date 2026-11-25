import 'server-only';
import type postgres from 'postgres';
import { cookies } from 'next/headers';
import { sql } from './admin';
import { SESSION_COOKIE, verifyStudent } from '../session';
import { UUID_RE } from '../uuid';
import { isWeekOpen } from '../dates';
import { STAR_VALUES, weekBonusDue } from '../stars';
import { BLOB_COLOR_KEYS, type BlobColorKey } from '../blobColors';
import type { WpStudent } from '../types';


export async function studentById(id: string): Promise<WpStudent | null> {
  if (!UUID_RE.test(id)) return null;
  const [row] = await sql<WpStudent[]>`select * from wp_students where id = ${id}`;
  return row ?? null;
}

export async function studentBySecret(secret: string): Promise<WpStudent | null> {
  if (!secret || secret.length > 200) return null;
  const [row] = await sql<WpStudent[]>`select * from wp_students where link_secret = ${secret}`;
  return row ?? null;
}

export interface JoinNames {
  classId: string;
  names: { id: string; displayName: string; blobColor: string | null }[];
}

/** Class code (any case) -> the class's kids, or null for an unknown code. */
export async function classByCode(code: string): Promise<JoinNames | null> {
  const [cls] = await sql<{ id: string }[]>`select id from wp_classes where class_code = ${code.trim().toUpperCase()}`;
  if (!cls) return null;
  const rows = await sql<{ id: string; display_name: string; blob_color: string | null }[]>`
    select id, display_name, blob_color from wp_students where class_id = ${cls.id} order by display_name`;
  return {
    classId: cls.id,
    names: rows.map((r) => ({ id: r.id, displayName: r.display_name, blobColor: r.blob_color })),
  };
}

/** The student, only if they belong to the class with this code. */
export async function studentForJoin(code: string, studentId: string): Promise<WpStudent | null> {
  if (!UUID_RE.test(studentId)) return null;
  const [row] = await sql<WpStudent[]>`
    select s.* from wp_students s join wp_classes c on c.id = s.class_id
    where s.id = ${studentId} and c.class_code = ${code.trim().toUpperCase()}`;
  return row ?? null;
}

/**
 * The signed-in kid, read from the cookie on every call. Deliberately uncached: a kid can switch
 * (or be switched) between any two requests, and every kid route must see the current one.
 */
export async function studentFromRequest(): Promise<WpStudent | null> {
  const jar = await cookies();
  const id = verifyStudent(jar.get(SESSION_COOKIE)?.value);
  return id ? studentById(id) : null;
}

/** Where a kid goes after signing in. */
export function landingPath(s: Pick<WpStudent, 'blob_color'>): '/pick' | '/' {
  return s.blob_color ? '/' : '/pick';
}

// ---- Progress, stars and home ------------------------------------------------------------

/** The lesson/question isn't one this student may write to (unassigned, locked week, or missing). Routes map it to 404. */
export class NotFoundError extends Error {
  constructor(what = 'not found') {
    super(what);
    this.name = 'NotFoundError';
  }
}

type Tx = postgres.TransactionSql;

/** Serializes all progress writes for one student, so concurrent tabs can't race the week bonus. */
async function lockStudent(tx: Tx, studentId: string): Promise<void> {
  const rows = await tx`select id from wp_students where id = ${studentId} for update`;
  if (rows.length === 0) throw new NotFoundError('student');
}

const assignedTo = (tx: Tx | typeof sql, studentId: string) => tx`
  select a.plan_id from wp_plan_assignments a
  where a.student_id = ${studentId}
     or a.class_id = (select class_id from wp_students where id = ${studentId})`;

const weekIsOpen = (opensOn: string | null, now: Date) => opensOn === null || isWeekOpen(opensOn, now);

/** A lesson of an assigned plan in an open week, else NotFoundError. */
async function authorizedLesson(tx: Tx, studentId: string, lessonId: string, now: Date) {
  if (!UUID_RE.test(lessonId)) throw new NotFoundError('lesson');
  const [row] = await tx<{ week_id: string; plan_id: string; opens_on: string | null }[]>`
    select l.week_id, w.plan_id, w.opens_on
    from wp_lessons l join wp_weeks w on w.id = l.week_id
    where l.id = ${lessonId} and w.plan_id in (${assignedTo(tx, studentId)})`;
  if (!row || !weekIsOpen(row.opens_on, now)) throw new NotFoundError('lesson');
  return row;
}

export async function completeLesson(
  studentId: string,
  lessonId: string,
  now: Date = new Date(),
): Promise<{ starsAwarded: number; weekDone: boolean }> {
  return sql.begin(async (tx) => {
    await lockStudent(tx, studentId);
    const lesson = await authorizedLesson(tx, studentId, lessonId, now);
    let starsAwarded = 0;

    const [completion] = await tx`
      insert into wp_lesson_completions (student_id, lesson_id) values (${studentId}, ${lessonId})
      on conflict (student_id, lesson_id) do nothing returning id`;
    if (completion) {
      const [ev] = await tx`
        insert into wp_star_events (student_id, plan_id, amount, reason, ref_id)
        values (${studentId}, ${lesson.plan_id}, ${STAR_VALUES.lesson}, 'lesson', ${lessonId})
        on conflict (student_id, reason, ref_id) do nothing returning id`;
      if (ev) starsAwarded += STAR_VALUES.lesson;
    }

    // Checked even on a repeat call: harmless, because the bonus insert is itself idempotent.
    const lessonIds = (await tx<{ id: string }[]>`select id from wp_lessons where week_id = ${lesson.week_id}`).map((r) => r.id);
    const done = new Set(
      (await tx<{ lesson_id: string }[]>`
        select lesson_id from wp_lesson_completions where student_id = ${studentId} and lesson_id = any(${lessonIds}::uuid[])`)
        .map((r) => r.lesson_id),
    );
    let weekDone = false;
    if (weekBonusDue(lessonIds, done)) {
      const [bonus] = await tx`
        insert into wp_star_events (student_id, plan_id, amount, reason, ref_id)
        values (${studentId}, ${lesson.plan_id}, ${STAR_VALUES.weekBonus}, 'week_bonus', ${lesson.week_id})
        on conflict (student_id, reason, ref_id) do nothing returning id`;
      if (bonus) {
        starsAwarded += STAR_VALUES.weekBonus;
        weekDone = true;
      }
    }
    return { starsAwarded, weekDone };
  });
}

export interface AttemptInput {
  clientAttemptId: string;
  questionId: string;
  correct: boolean;
  context: 'lesson' | 'free';
}

export async function recordAttempt(
  studentId: string,
  input: AttemptInput,
  now: Date = new Date(),
): Promise<{ starsAwarded: number }> {
  return sql.begin(async (tx) => {
    await lockStudent(tx, studentId);
    if (!UUID_RE.test(input.questionId)) throw new NotFoundError('question');
    // Soft-deleted questions still accept attempts: an in-progress lesson must be able to finish.
    const [q] = await tx<{ plan_id: string; opens_on: string | null }[]>`
      select w.plan_id, w.opens_on
      from wp_questions qu join wp_lessons l on l.id = qu.lesson_id join wp_weeks w on w.id = l.week_id
      where qu.id = ${input.questionId} and w.plan_id in (${assignedTo(tx, studentId)})`;
    if (!q || !weekIsOpen(q.opens_on, now)) throw new NotFoundError('question');

    const [inserted] = await tx<{ id: string }[]>`
      insert into wp_attempts (student_id, question_id, client_attempt_id, correct, context)
      values (${studentId}, ${input.questionId}, ${input.clientAttemptId}, ${input.correct}, ${input.context})
      on conflict (client_attempt_id) do nothing returning id`;

    if (!inserted) {
      // A retry. Same student: report what the original call awarded. Anyone else: nothing, and nothing leaks.
      const [existing] = await tx<{ id: string; student_id: string }[]>`
        select id, student_id from wp_attempts where client_attempt_id = ${input.clientAttemptId}`;
      if (!existing || existing.student_id !== studentId) return { starsAwarded: 0 };
      const [ev] = await tx<{ amount: number }[]>`
        select amount from wp_star_events
        where student_id = ${studentId} and reason = 'free_correct' and ref_id = ${existing.id}`;
      return { starsAwarded: ev?.amount ?? 0 };
    }

    if (input.correct && input.context === 'free') {
      const [ev] = await tx`
        insert into wp_star_events (student_id, plan_id, amount, reason, ref_id)
        values (${studentId}, ${q.plan_id}, ${STAR_VALUES.freeCorrect}, 'free_correct', ${inserted.id})
        on conflict (student_id, reason, ref_id) do nothing returning id`;
      if (ev) return { starsAwarded: STAR_VALUES.freeCorrect };
    }
    return { starsAwarded: 0 };
  });
}

export interface HomeData {
  student: { id: string; displayName: string; blobColor: string | null };
  totalStars: number;
  plan: { id: string; title: string } | null;
  weeks: {
    id: string; skill: string; opensOn: string | null; open: boolean; done: boolean;
    lessons: { id: string; title: string; done: boolean }[];
  }[];
  currentWeekId: string | null;
}

export async function getHome(studentId: string, now: Date = new Date()): Promise<HomeData> {
  const [student] = await sql<WpStudent[]>`select * from wp_students where id = ${studentId}`;
  if (!student) throw new NotFoundError('student');

  const [plan] = await sql<{ id: string; title: string }[]>`
    select id, title from wp_plans where id in (${assignedTo(sql, studentId)})
    order by created_at desc, id limit 1`;
  const [{ total }] = await sql<{ total: number }[]>`
    select coalesce(sum(amount), 0)::int as total from wp_star_events
    where student_id = ${studentId} and plan_id in (${assignedTo(sql, studentId)})`;

  let weeks: HomeData['weeks'] = [];
  if (plan) {
    const rows = await sql<{
      week_id: string; skill: string; opens_on: string | null;
      lesson_id: string | null; title: string | null; done: boolean | null;
    }[]>`
      select w.id as week_id, w.skill, w.opens_on, l.id as lesson_id, l.title,
             (c.id is not null) as done
      from wp_weeks w
      left join wp_lessons l on l.week_id = w.id
      left join wp_lesson_completions c on c.lesson_id = l.id and c.student_id = ${studentId}
      where w.plan_id = ${plan.id}
      order by w.position, l.position`;
    const byWeek = new Map<string, HomeData['weeks'][number]>();
    for (const r of rows) {
      let w = byWeek.get(r.week_id);
      if (!w) {
        w = { id: r.week_id, skill: r.skill, opensOn: r.opens_on, open: weekIsOpen(r.opens_on, now), done: false, lessons: [] };
        byWeek.set(r.week_id, w);
      }
      if (r.lesson_id) w.lessons.push({ id: r.lesson_id, title: r.title ?? '', done: !!r.done });
    }
    weeks = [...byWeek.values()];
    for (const w of weeks) w.done = weekBonusDue(w.lessons.map((l) => l.id), new Set(w.lessons.filter((l) => l.done).map((l) => l.id)));
  }

  const open = weeks.filter((w) => w.open);
  const currentWeekId = (open.find((w) => !w.done) ?? open[open.length - 1])?.id ?? null;

  return {
    student: { id: student.id, displayName: student.display_name, blobColor: student.blob_color },
    totalStars: total,
    plan: plan ?? null,
    weeks,
    currentWeekId,
  };
}

export async function setBlobColor(studentId: string, color: BlobColorKey): Promise<void> {
  if (!BLOB_COLOR_KEYS.includes(color)) throw new Error('bad blob color');
  await sql`update wp_students set blob_color = ${color} where id = ${studentId}`;
}
