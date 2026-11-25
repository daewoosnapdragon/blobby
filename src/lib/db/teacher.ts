import 'server-only';
import { sql } from './admin';
import { starEventsFor, NotFoundError } from './kid';
import { makeLinkSecret } from '../roster';
import { UUID_RE } from '../uuid';
import { computeClassStats, skillHistory, type StatLesson, type StatAttempt, type StudentStats } from '../stats';

export interface ClassCard { id: string; name: string; classCode: string; grade: number; kidCount: number; totalStars: number }

export async function listClasses(): Promise<ClassCard[]> {
  const classes = await sql<{ id: string; name: string; class_code: string; grade: number }[]>`
    select id, name, class_code, grade from wp_classes order by grade, name`;
  const kids = await sql<{ id: string; class_id: string }[]>`select id, class_id from wp_students`;
  const events = await starEventsFor(kids.map((k) => k.id));
  const classOf = new Map(kids.map((k) => [k.id, k.class_id]));
  return classes.map((c) => ({
    id: c.id, name: c.name, classCode: c.class_code, grade: c.grade,
    kidCount: kids.filter((k) => k.class_id === c.id).length,
    totalStars: events.filter((e) => classOf.get(e.studentId) === c.id).reduce((n, e) => n + e.amount, 0),
  }));
}

/** Lessons (with their week's skill) of every plan assigned to this class or to one of its kids. */
async function lessonsForClass(classId: string): Promise<StatLesson[]> {
  return sql<StatLesson[]>`
    select l.id, l.week_id as "weekId", w.skill as "weekSkill"
    from wp_lessons l join wp_weeks w on w.id = l.week_id
    where w.plan_id in (
      select plan_id from wp_plan_assignments
      where class_id = ${classId}
         or student_id in (select id from wp_students where class_id = ${classId}))`;
}

export interface ClassView { classId: string; className: string; classCode: string; rows: StudentStats[] }

export async function classStats(classId: string): Promise<ClassView | null> {
  if (!UUID_RE.test(classId)) return null;
  const [cls] = await sql<{ id: string; name: string; class_code: string }[]>`select id, name, class_code from wp_classes where id = ${classId}`;
  if (!cls) return null;
  const kids = await sql<{ id: string; display_name: string; blob_color: string | null }[]>`
    select id, display_name, blob_color from wp_students where class_id = ${classId} order by display_name, id`;
  const ids = kids.map((k) => k.id);

  const [starEvents, practiceDays, completions, lessons, attempts] = await Promise.all([
    starEventsFor(ids),
    sql<{ studentId: string; day: string; seconds: number }[]>`
      select student_id as "studentId", day, seconds from wp_practice_days where student_id = any(${ids}::uuid[])`,
    sql<{ studentId: string; lessonId: string }[]>`
      select student_id as "studentId", lesson_id as "lessonId" from wp_lesson_completions where student_id = any(${ids}::uuid[])`,
    lessonsForClass(classId),
    // Only each kid's newest attempt is needed for "last skill". The join deliberately ignores
    // wp_questions.deleted_at: an attempt on a since-deleted question is still practice.
    sql<StatAttempt[]>`
      select distinct on (a.student_id) a.student_id as "studentId", a.question_id as "questionId",
             q.lesson_id as "lessonId", a.created_at as "createdAt"
      from wp_attempts a join wp_questions q on q.id = a.question_id
      where a.student_id = any(${ids}::uuid[])
      order by a.student_id, a.created_at desc`,
  ]);

  return {
    classId: cls.id, className: cls.name, classCode: cls.class_code,
    rows: computeClassStats({
      students: kids.map((k) => ({ id: k.id, displayName: k.display_name, blobColor: k.blob_color })),
      starEvents, practiceDays, completions, lessons, attempts,
    }),
  };
}

export interface StudentDetail {
  student: { id: string; displayName: string; blobColor: string | null };
  classId: string;
  className: string;
  history: { skill: string; dates: string[] }[];
}

export async function studentDetail(studentId: string): Promise<StudentDetail | null> {
  if (!UUID_RE.test(studentId)) return null;
  const [s] = await sql<{ id: string; display_name: string; blob_color: string | null; class_id: string; class_name: string }[]>`
    select s.id, s.display_name, s.blob_color, s.class_id, c.name as class_name
    from wp_students s join wp_classes c on c.id = s.class_id where s.id = ${studentId}`;
  if (!s) return null;
  const [lessons, attempts] = await Promise.all([
    lessonsForClass(s.class_id),
    sql<StatAttempt[]>`
      select a.student_id as "studentId", a.question_id as "questionId", q.lesson_id as "lessonId", a.created_at as "createdAt"
      from wp_attempts a join wp_questions q on q.id = a.question_id
      where a.student_id = ${studentId}`,
  ]);
  return {
    student: { id: s.id, displayName: s.display_name, blobColor: s.blob_color },
    classId: s.class_id, className: s.class_name,
    history: skillHistory(studentId, { attempts, lessons }),
  };
}

export const DISPLAY_NAME_MAX = 40;

/** Kyla may edit any display name (spec 7.1). Trimmed, 1-40 characters. */
export async function setDisplayName(studentId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > DISPLAY_NAME_MAX) throw new Error('display name must be 1-40 characters');
  if (!UUID_RE.test(studentId)) throw new NotFoundError('student not found');
  const rows = await sql`update wp_students set display_name = ${trimmed} where id = ${studentId} returning id`;
  if (rows.length === 0) throw new NotFoundError('student not found');
}

/**
 * Replace a kid's card secret. The old /s/<secret> link stops resolving at once; devices that already
 * signed in keep their cookie (it holds the student id, not the secret). Returns the new secret: never log it.
 */
export async function reissueLink(studentId: string): Promise<string> {
  if (!UUID_RE.test(studentId)) throw new NotFoundError('student not found');
  const secret = makeLinkSecret();
  const rows = await sql`update wp_students set link_secret = ${secret} where id = ${studentId} returning id`;
  if (rows.length === 0) throw new NotFoundError('student not found');
  return secret;
}

export interface CardsData {
  className: string; classCode: string;
  students: { id: string; displayName: string; blobColor: string | null; secret: string }[];
}

/** Everything the printable cards need. With studentId, only that kid (empty list if they are not in this class). Null for an unknown class. */
export async function cardsForClass(classId: string, studentId?: string): Promise<CardsData | null> {
  if (!UUID_RE.test(classId)) return null;
  const [cls] = await sql<{ name: string; class_code: string }[]>`select name, class_code from wp_classes where id = ${classId}`;
  if (!cls) return null;
  const only = studentId !== undefined && UUID_RE.test(studentId) ? studentId : null;
  const kids = studentId !== undefined && only === null ? [] : await sql<{ id: string; display_name: string; blob_color: string | null; link_secret: string }[]>`
    select id, display_name, blob_color, link_secret from wp_students
    where class_id = ${classId} and (${only}::uuid is null or id = ${only}::uuid)
    order by display_name, id`;
  return {
    className: cls.name, classCode: cls.class_code,
    students: kids.map((k) => ({ id: k.id, displayName: k.display_name, blobColor: k.blob_color, secret: k.link_secret })),
  };
}
