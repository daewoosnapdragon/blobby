import 'server-only';
import type postgres from 'postgres';
import { cookies } from 'next/headers';
import { sql } from './admin';
import { bonusPick, countRun, forgetPicks, mixIn, reviewQuestions, skillPractice, storedBonus } from './track';
import { isPracticeBonus, lessonBonusSeed } from '../bonus';
import type { SkillKey } from '../skills';
import { SESSION_COOKIE, verifyStudent } from '../session';
import { UUID_RE } from '../uuid';
import { isWeekOpen, seoulDate } from '../dates';
import { STAR_VALUES, weekBonusDue } from '../stars';
import { BLOB_COLOR_KEYS, type BlobColorKey } from '../blobColors';
import { parseQuestion, type Question } from '../questions/schema';
import { pickFreePractice, PRACTICE_SET_SIZE } from '../practice';
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
    select id, display_name, blob_color from wp_students where class_id = ${cls.id} and not is_preview order by display_name`;
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
    where s.id = ${studentId} and c.class_code = ${code.trim().toUpperCase()} and not s.is_preview`;
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

/** A week with no opens_on date fails closed: it stays locked. A practice student sees every week open. */
const weekIsOpen = (opensOn: string | null, now: Date, preview = false) => preview || (opensOn !== null && isWeekOpen(opensOn, now));

/** "Is this the class's practice student?", as a column for queries that already run. */
const previewOf = (tx: Tx | typeof sql, studentId: string) =>
  tx`coalesce((select is_preview from wp_students where id = ${studentId}), false)`;

/** A lesson of an assigned plan in an open week, else NotFoundError. */
async function authorizedLesson(tx: Tx | typeof sql, studentId: string, lessonId: string, now: Date) {
  if (!UUID_RE.test(lessonId)) throw new NotFoundError('lesson');
  const [row] = await tx<{ week_id: string; plan_id: string; opens_on: string | null; preview: boolean }[]>`
    select l.week_id, w.plan_id, w.opens_on, ${previewOf(tx, studentId)} as preview
    from wp_lessons l join wp_weeks w on w.id = l.week_id
    where l.id = ${lessonId} and w.plan_id in (${assignedTo(tx, studentId)})`;
  if (!row || !weekIsOpen(row.opens_on, now, row.preview)) throw new NotFoundError('lesson');
  return row;
}

export async function completeLesson(
  studentId: string,
  lessonId: string,
  now: Date = new Date(),
  /** the lesson run's id: its answers update the kid's review track (once per run) */
  runId?: string,
): Promise<{ starsAwarded: number; weekDone: boolean; lessonStars: number; bonusStars: number }> {
  return sql.begin(async (tx) => {
    await lockStudent(tx, studentId);
    const lesson = await authorizedLesson(tx, studentId, lessonId, now);
    let starsAwarded = 0;
    let lessonStars = 0;
    let bonusStars = 0;

    const [completion] = await tx`
      insert into wp_lesson_completions (student_id, lesson_id) values (${studentId}, ${lessonId})
      on conflict (student_id, lesson_id) do nothing returning id`;
    if (completion) {
      const [ev] = await tx`
        insert into wp_star_events (student_id, plan_id, amount, reason, ref_id)
        values (${studentId}, ${lesson.plan_id}, ${STAR_VALUES.lesson}, 'lesson', ${lessonId})
        on conflict (student_id, reason, ref_id) do nothing returning id`;
      if (ev) {
        starsAwarded += STAR_VALUES.lesson;
        lessonStars = STAR_VALUES.lesson;
      }

      // The bonus question stored for this play-through (read before forgetPicks drops it) pays only when
      // this run's first attempt at it was right. Deleted or since-reordered questions still count: it's the stored id.
      const bonusId = await storedBonus(tx, studentId, lessonId);
      if (bonusId && runId && UUID_RE.test(runId)) {
        const [first] = await tx<{ correct: boolean }[]>`
          select correct from wp_attempts
          where student_id = ${studentId} and run_id = ${runId} and question_id = ${bonusId}
          order by created_at asc limit 1`;
        if (first?.correct) {
          const [bonusEv] = await tx`
            insert into wp_star_events (student_id, plan_id, amount, reason, ref_id)
            values (${studentId}, ${lesson.plan_id}, ${STAR_VALUES.lessonBonus}, 'lesson_bonus', ${lessonId})
            on conflict (student_id, reason, ref_id) do nothing returning id`;
          if (bonusEv) {
            starsAwarded += STAR_VALUES.lessonBonus;
            bonusStars = STAR_VALUES.lessonBonus;
          }
        }
      }
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
    if (runId && UUID_RE.test(runId)) await countRun(tx, studentId, runId, now);
    await forgetPicks(tx, studentId, lessonId);
    return { starsAwarded, weekDone, lessonStars, bonusStars };
  });
}

export interface AttemptInput {
  clientAttemptId: string;
  questionId: string;
  correct: boolean;
  context: 'lesson' | 'free';
  /** the lesson or practice run this answer belongs to */
  runId?: string;
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
    const [q] = await tx<{ plan_id: string | null; opens_on: string | null; preview: boolean; bank: boolean }[]>`
      select w.plan_id, w.opens_on, ${previewOf(tx, studentId)} as preview, (qu.bank_grade is not null) as bank
      from wp_questions qu left join wp_lessons l on l.id = qu.lesson_id left join wp_weeks w on w.id = l.week_id
      where qu.id = ${input.questionId}
        and (w.plan_id in (${assignedTo(tx, studentId)})
          or qu.bank_grade = (select c.grade from wp_students s join wp_classes c on c.id = s.class_id where s.id = ${studentId}))`;
    // Review-bank questions belong to a grade, not a week: no week to be open.
    if (!q || (!q.bank && !weekIsOpen(q.opens_on, now, q.preview))) throw new NotFoundError('question');
    const runId = input.runId && UUID_RE.test(input.runId) ? input.runId : null;

    // Answering anything counts as practicing today (a stamp), even a retry; never touches seconds already counted.
    await tx`
      insert into wp_practice_days (student_id, day, seconds) values (${studentId}, ${seoulDate(now)}, 0)
      on conflict (student_id, day) do nothing`;

    const [inserted] = await tx<{ id: string }[]>`
      insert into wp_attempts (student_id, question_id, client_attempt_id, correct, context, run_id)
      values (${studentId}, ${input.questionId}, ${input.clientAttemptId}, ${input.correct}, ${input.context}, ${runId})
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
      // A bank question belongs to no plan: its star counts toward the plan on the kid's home screen. No plan, no star.
      const planId = q.plan_id ?? (await getHome(studentId, now)).plan?.id ?? null;
      if (!planId) return { starsAwarded: 0 };
      // The day of this answer decides, not the day the set was loaded.
      const amount = isPracticeBonus(studentId, seoulDate(now), input.questionId) ? STAR_VALUES.freeBonus : STAR_VALUES.freeCorrect;
      const [ev] = await tx`
        insert into wp_star_events (student_id, plan_id, amount, reason, ref_id)
        values (${studentId}, ${planId}, ${amount}, 'free_correct', ${inserted.id})
        on conflict (student_id, reason, ref_id) do nothing returning id`;
      if (ev) return { starsAwarded: amount };
    }
    return { starsAwarded: 0 };
  });
}

/** Seconds of practice one ping is worth, and the most one day can hold (3 hours). */
export const PING_SECONDS = 30;
export const DAY_SECONDS_CAP = 10800;

/** Adds one ping's worth of practice time to today's (Seoul) row, in a single atomic statement. */
export async function ping(studentId: string, now: Date = new Date()): Promise<void> {
  await sql`
    insert into wp_practice_days (student_id, day, seconds) values (${studentId}, ${seoulDate(now)}, ${PING_SECONDS})
    on conflict (student_id, day)
    do update set seconds = least(wp_practice_days.seconds + ${PING_SECONDS}, ${DAY_SECONDS_CAP})`;
}

/** The Seoul dates (YYYY-MM-DD) in `month` (YYYY-MM) this kid practiced, oldest first. */
export async function practicedDays(studentId: string, month: string): Promise<string[]> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  const rows = await sql<{ day: string }[]>`
    select day from wp_practice_days
    where student_id = ${studentId} and day >= ${month + '-01'}::date and day < (${month + '-01'}::date + interval '1 month')
    order by day`;
  return rows.map((r) => r.day);
}

export interface HomeData {
  student: { id: string; displayName: string; blobColor: string | null };
  totalStars: number;
  plan: { id: string; title: string } | null;
  weeks: {
    id: string; number: number; skill: string; opensOn: string | null; open: boolean; done: boolean;
    lessons: { id: string; title: string; done: boolean }[];
  }[];
  currentWeekId: string | null;
}

type HomeWeek = HomeData['weeks'][number];

/** The weeks (with this kid's lesson checks) of each given plan, in week/lesson order. */
async function weeksByPlan(studentId: string, planIds: string[], now: Date, preview: boolean): Promise<Map<string, HomeWeek[]>> {
  const out = new Map<string, HomeWeek[]>(planIds.map((p) => [p, []]));
  if (planIds.length === 0) return out;
  const rows = await sql<{
    plan_id: string; week_id: string; position: number; skill: string; opens_on: string | null;
    lesson_id: string | null; title: string | null; done: boolean | null;
  }[]>`
    select w.plan_id, w.id as week_id, w.position, w.skill, w.opens_on, l.id as lesson_id, l.title,
           (c.id is not null) as done
    from wp_weeks w
    left join wp_lessons l on l.week_id = w.id
    left join wp_lesson_completions c on c.lesson_id = l.id and c.student_id = ${studentId}
    where w.plan_id = any(${planIds}::uuid[])
    order by w.plan_id, w.position, l.position`;
  const byWeek = new Map<string, HomeWeek>();
  for (const r of rows) {
    let w = byWeek.get(r.week_id);
    if (!w) {
      w = { id: r.week_id, number: r.position, skill: r.skill, opensOn: r.opens_on, open: weekIsOpen(r.opens_on, now, preview), done: false, lessons: [] };
      byWeek.set(r.week_id, w);
      out.get(r.plan_id)!.push(w);
    }
    if (r.lesson_id) w.lessons.push({ id: r.lesson_id, title: r.title ?? '', done: !!r.done });
  }
  for (const w of byWeek.values()) {
    w.done = weekBonusDue(w.lessons.map((l) => l.id), new Set(w.lessons.filter((l) => l.done).map((l) => l.id)));
  }
  return out;
}

/**
 * Home shows one plan. Several can be assigned at once (the winter plan is imported while the test weeks
 * still run), so the current one is: the newest assigned plan with an open week that isn't done, else the
 * newest with any open week, else the newest overall.
 */
export async function getHome(studentId: string, now: Date = new Date()): Promise<HomeData> {
  const [student] = await sql<WpStudent[]>`select * from wp_students where id = ${studentId}`;
  if (!student) throw new NotFoundError('student');

  const plans = await sql<{ id: string; title: string }[]>`
    select id, title from wp_plans where id in (${assignedTo(sql, studentId)})
    order by created_at desc, id`;
  const [total, byPlan] = await Promise.all([totalStarsFor(studentId), weeksByPlan(studentId, plans.map((p) => p.id), now, student.is_preview)]);
  const weeksOf = (p: { id: string }) => byPlan.get(p.id) ?? [];
  const plan =
    plans.find((p) => weeksOf(p).some((w) => w.open && !w.done)) ??
    plans.find((p) => weeksOf(p).some((w) => w.open)) ??
    plans[0];
  const weeks = plan ? weeksOf(plan) : [];

  const open = weeks.filter((w) => w.open);
  const currentWeekId = (open.find((w) => !w.done) ?? open[open.length - 1])?.id ?? null;

  return {
    student: { id: student.id, displayName: student.display_name, blobColor: student.blob_color },
    totalStars: total,
    plan: plan ? { id: plan.id, title: plan.title } : null,
    weeks,
    currentWeekId,
  };
}

export interface WeekData {
  student: HomeData['student'];
  totalStars: number;
  week: HomeWeek;
}

/** One open week of ANY plan assigned to this kid (not only home's current plan), else null. */
export async function getWeek(studentId: string, weekId: string, now: Date = new Date()): Promise<WeekData | null> {
  if (!UUID_RE.test(weekId)) return null;
  const [student] = await sql<WpStudent[]>`select * from wp_students where id = ${studentId}`;
  if (!student) return null;
  const [row] = await sql<{ plan_id: string; opens_on: string | null }[]>`
    select plan_id, opens_on from wp_weeks where id = ${weekId} and plan_id in (${assignedTo(sql, studentId)})`;
  if (!row || !weekIsOpen(row.opens_on, now, student.is_preview)) return null;
  const [byPlan, totalStars] = await Promise.all([weeksByPlan(studentId, [row.plan_id], now, student.is_preview), totalStarsFor(studentId)]);
  const week = byPlan.get(row.plan_id)?.find((w) => w.id === weekId);
  if (!week) return null;
  return {
    student: { id: student.id, displayName: student.display_name, blobColor: student.blob_color },
    totalStars,
    week,
  };
}

export async function setBlobColor(studentId: string, color: BlobColorKey): Promise<void> {
  if (!BLOB_COLOR_KEYS.includes(color)) throw new Error('bad blob color');
  await sql`update wp_students set blob_color = ${color} where id = ${studentId}`;
}

/**
 * Star events that count toward a kid's total: those from plans assigned to that kid (their class or them).
 * The one definition of "stars this break", shared by the kid's pill and the teacher view.
 */
export async function starEventsFor(studentIds: string[]): Promise<{ studentId: string; amount: number }[]> {
  if (studentIds.length === 0) return [];
  return sql<{ studentId: string; amount: number }[]>`
    select e.student_id as "studentId", e.amount from wp_star_events e
    where e.student_id = any(${studentIds}::uuid[])
      and e.plan_id in (
        select a.plan_id from wp_plan_assignments a
        where a.student_id = e.student_id
           or a.class_id = (select class_id from wp_students where id = e.student_id))`;
}

/** Stars from the kid's assigned plan(s): the number on the home pill and the treasure chest. */
export async function totalStarsFor(studentId: string): Promise<number> {
  return (await starEventsFor([studentId])).reduce((n, e) => n + e.amount, 0);
}

async function studentWithGrade(studentId: string) {
  const [row] = await sql<{ id: string; display_name: string; blob_color: string | null; grade: number }[]>`
    select s.id, s.display_name, s.blob_color, c.grade
    from wp_students s join wp_classes c on c.id = s.class_id where s.id = ${studentId}`;
  if (!row) throw new NotFoundError('student');
  return row;
}

export interface LessonQuestion {
  id: string;
  question: Question;
  /** spoken text -> audio URL (spec 5.7); only string URLs are kept */
  audio: Record<string, string>;
  /** the question's skill key (src/lib/skills.ts), if tagged */
  skill?: string | null;
  /** a review-track question chosen for this kid ("Just for you") */
  forYou?: boolean;
  /** this lesson's bonus class question for this kid (never a "just for you" one) */
  bonus?: boolean;
}

export interface LessonData {
  student: { id: string; displayName: string; blobColor: string | null; grade: number };
  totalStars: number;
  lesson: { id: string; title: string; position: number };
  week: { id: string; number: number; skill: string; lessonCount: number; done: boolean };
  /** this kid finished this lesson before (a redo earns no stars) */
  lessonDone: boolean;
  /** every other lesson of the week is finished (this one is the last undone one) */
  otherLessonsDone: boolean;
  questions: LessonQuestion[];
}

function audioMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) if (typeof v === 'string' && v) out[k] = v;
  }
  return out;
}

/** A lesson the kid may play (assigned plan, open week), else NotFoundError. Same authorization as completeLesson. */
export async function getLesson(studentId: string, lessonId: string, now: Date = new Date()): Promise<LessonData> {
  const student = await studentWithGrade(studentId);
  const auth = await authorizedLesson(sql, studentId, lessonId, now);

  const [[lesson], [week], lessons, qs, totalStars] = await Promise.all([
    sql<{ id: string; title: string; position: number }[]>`select id, title, position from wp_lessons where id = ${lessonId}`,
    sql<{ id: string; position: number; skill: string }[]>`select id, position, skill from wp_weeks where id = ${auth.week_id}`,
    sql<{ id: string; done: boolean }[]>`
      select l.id, exists(select 1 from wp_lesson_completions c where c.lesson_id = l.id and c.student_id = ${studentId}) as done
      from wp_lessons l where l.week_id = ${auth.week_id}`,
    sql<{ id: string; type: string; payload: unknown; audio: unknown; skill: string | null }[]>`
      select id, type, payload, audio, skill from wp_questions
      where lesson_id = ${lessonId} and deleted_at is null order by position, id`,
    totalStarsFor(studentId),
  ]);

  const questions: LessonQuestion[] = [];
  for (const q of qs) {
    try {
      questions.push({ id: q.id, question: parseQuestion(q.type, q.payload), audio: audioMap(q.audio), skill: q.skill, forYou: false });
    } catch {
      // A malformed question is skipped rather than breaking the whole lesson for the kid.
    }
  }

  const done = new Set(lessons.filter((l) => l.done).map((l) => l.id));
  // "Just for you": saved for this kid and lesson until it is finished (a redo after that may differ).
  const review = await reviewQuestions(studentId, student.grade, lessonId, `${studentId}:${lessonId}:${done.has(lessonId) ? 1 : 0}`);
  // The bonus is a class question (never a watch_answer), saved in the same row as the review picks (so after reviewQuestions).
  const bonusable = questions.filter((q) => q.question.type !== 'watch_answer').map((q) => q.id);
  const bonus = await bonusPick(studentId, lessonId, bonusable, lessonBonusSeed(studentId, lessonId, done.has(lessonId)));
  return {
    student: { id: student.id, displayName: student.display_name, blobColor: student.blob_color, grade: student.grade },
    totalStars,
    lesson,
    week: {
      id: week.id, number: week.position, skill: week.skill, lessonCount: lessons.length,
      done: weekBonusDue(lessons.map((l) => l.id), done),
    },
    lessonDone: done.has(lessonId),
    otherLessonsDone: lessons.every((l) => l.id === lessonId || l.done),
    questions: mixIn(questions.map((q) => ({ ...q, bonus: q.id === bonus })), review),
  };
}

export interface WeekDoneData {
  student: { id: string; displayName: string; blobColor: string | null };
  week: { id: string; number: number; skill: string; done: boolean };
  /** this week's lesson stars, their lesson bonuses, and its week bonus (R24) */
  weekStars: number;
  totalStars: number;
}

/** The week-done celebration's numbers, for an open week of an assigned plan, else NotFoundError. */
export async function getWeekDone(studentId: string, weekId: string, now: Date = new Date()): Promise<WeekDoneData> {
  if (!UUID_RE.test(weekId)) throw new NotFoundError('week');
  const [student] = await sql<WpStudent[]>`select * from wp_students where id = ${studentId}`;
  if (!student) throw new NotFoundError('student');
  const [week] = await sql<{ id: string; position: number; skill: string; opens_on: string | null }[]>`
    select id, position, skill, opens_on from wp_weeks
    where id = ${weekId} and plan_id in (${assignedTo(sql, studentId)})`;
  if (!week || !weekIsOpen(week.opens_on, now, student.is_preview)) throw new NotFoundError('week');

  const [lessons, [{ weekStars }], totalStars] = await Promise.all([
    sql<{ id: string; done: boolean }[]>`
      select l.id, exists(select 1 from wp_lesson_completions c where c.lesson_id = l.id and c.student_id = ${studentId}) as done
      from wp_lessons l where l.week_id = ${weekId}`,
    sql<{ weekStars: number }[]>`
      select coalesce(sum(amount), 0)::int as "weekStars" from wp_star_events
      where student_id = ${studentId}
        and ((reason in ('lesson', 'lesson_bonus') and ref_id in (select id from wp_lessons where week_id = ${weekId}))
          or (reason = 'week_bonus' and ref_id = ${weekId}))`,
    totalStarsFor(studentId),
  ]);
  return {
    student: { id: student.id, displayName: student.display_name, blobColor: student.blob_color },
    week: {
      id: week.id, number: week.position, skill: week.skill,
      done: weekBonusDue(lessons.map((l) => l.id), new Set(lessons.filter((l) => l.done).map((l) => l.id))),
    },
    weekStars,
    totalStars,
  };
}

// ---- Free practice -----------------------------------------------------------------------

/**
 * Questions this kid last got wrong (in a lesson or in free practice). A question leaves the set as soon
 * as the kid's latest attempt on it is correct. Soft-deleted questions are never in it.
 */
export async function getMissedIds(studentId: string): Promise<Set<string>> {
  const rows = await sql<{ question_id: string }[]>`
    select question_id from (
      select distinct on (a.question_id) a.question_id, a.correct
      from wp_attempts a join wp_questions q on q.id = a.question_id
      where a.student_id = ${studentId} and q.deleted_at is null
      order by a.question_id, a.created_at desc
    ) latest
    where not correct`;
  return new Set(rows.map((r) => r.question_id));
}

/** Every playable question of the kid's open weeks (assigned plans): not deleted, not watch_answer, not malformed. */
async function practicePool(studentId: string, now: Date): Promise<LessonQuestion[]> {
  const rows = await sql<{ id: string; type: string; payload: unknown; audio: unknown; opens_on: string | null; preview: boolean }[]>`
    select q.id, q.type, q.payload, q.audio, w.opens_on, ${previewOf(sql, studentId)} as preview
    from wp_questions q
    join wp_lessons l on l.id = q.lesson_id
    join wp_weeks w on w.id = l.week_id
    where q.deleted_at is null and q.type <> 'watch_answer'
      and w.plan_id in (${assignedTo(sql, studentId)})
    order by w.position, l.position, q.position, q.id`;
  const pool: LessonQuestion[] = [];
  for (const r of rows) {
    if (!weekIsOpen(r.opens_on, now, r.preview)) continue;
    try {
      pool.push({ id: r.id, question: parseQuestion(r.type, r.payload), audio: audioMap(r.audio) });
    } catch {
      // skipped, like in lessons
    }
  }
  return pool;
}

/** A free-practice set: up to 8 mixed questions, missed ones 3x as likely, in the order they'll be asked. */
export async function getPracticeSet(
  studentId: string,
  now: Date = new Date(),
  n: number = PRACTICE_SET_SIZE,
  rand: () => number = Math.random,
): Promise<LessonQuestion[]> {
  const [pool, missed] = await Promise.all([practicePool(studentId, now), getMissedIds(studentId)]);
  const byId = new Map(pool.map((q) => [q.id, q]));
  const day = seoulDate(now);
  return pickFreePractice(pool.map((q) => ({ id: q.id, deleted: false })), missed, n, rand)
    .map((qid) => ({ ...byId.get(qid)!, bonus: isPracticeBonus(studentId, day, qid) }));
}

/** Is there anything to practice yet? (Home shows the free-practice card as opening later when not.) */
export async function practiceAvailable(studentId: string, now: Date = new Date()): Promise<boolean> {
  const weeks = await sql<{ opens_on: string | null; preview: boolean }[]>`
    select distinct w.opens_on, ${previewOf(sql, studentId)} as preview
    from wp_questions q
    join wp_lessons l on l.id = q.lesson_id
    join wp_weeks w on w.id = l.week_id
    where q.deleted_at is null and q.type <> 'watch_answer'
      and w.plan_id in (${assignedTo(sql, studentId)})`;
  return weeks.some((w) => weekIsOpen(w.opens_on, now, w.preview));
}

/** What the practice screen needs besides the questions. */
export async function getPracticeStudent(studentId: string) {
  const [student, totalStars] = await Promise.all([studentWithGrade(studentId), totalStarsFor(studentId)]);
  return { id: student.id, displayName: student.display_name, blobColor: student.blob_color, grade: student.grade, totalStars };
}

/** Practice again: up to 5 questions on one skill (the kid's missed ones first, then the review bank, then open class questions). */
export async function getSkillPractice(studentId: string, skill: SkillKey, now: Date = new Date()): Promise<LessonQuestion[]> {
  const student = await studentWithGrade(studentId);
  const [pool, missed] = await Promise.all([practicePool(studentId, now), getMissedIds(studentId)]);
  const day = seoulDate(now);
  const set = await skillPractice(student.id, student.grade, skill, new Set(pool.map((q) => q.id)), missed);
  return set.map((q) => ({ ...q, bonus: isPracticeBonus(studentId, day, q.id) }));
}
