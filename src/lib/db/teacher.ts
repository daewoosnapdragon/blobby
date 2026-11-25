import 'server-only';
import { sql } from './admin';
import { starEventsFor, NotFoundError } from './kid';
import { makeLinkSecret } from '../roster';
import { UUID_RE } from '../uuid';
import { parseQuestion, type Question } from '../questions/schema';
import { questionProblems } from '../questions/problems';
import { spokenStrings } from '../spoken';
import { ensureAudio, defaultAudioDeps, type AudioDeps } from '../tts';
import { checkEmbeddable, parseYouTubeId } from '../youtube';
import { isRealDate, weekdayName } from '../dates';
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

// ---- Plan setup and the question editor (Task 15) ------------------------------------------

/** The form's mistakes, as sentences Kyla can act on. Nothing was saved. */
export class EditorError extends Error {
  constructor(public problems: string[]) { super(problems.join(' ')); }
}

export interface PlanLesson { id: string; position: number; title: string; questionCount: number }
export interface PlanWeek { id: string; position: number; skill: string; opensOn: string | null; weekday: string; lessons: PlanLesson[] }
export interface PlansForClass {
  id: string; name: string; grade: number;
  plans: { id: string; title: string; weeks: PlanWeek[] }[];
}

/** Every class with the plan(s) assigned to the whole class: weeks, then lessons. Soft-deleted questions are not counted. */
export async function listPlans(): Promise<PlansForClass[]> {
  const [classes, assigned, weeks, lessons] = await Promise.all([
    sql<{ id: string; name: string; grade: number }[]>`select id, name, grade from wp_classes order by grade, name`,
    sql<{ class_id: string; plan_id: string; title: string }[]>`
      select a.class_id, p.id as plan_id, p.title
      from wp_plan_assignments a join wp_plans p on p.id = a.plan_id
      where a.class_id is not null order by p.created_at, p.title`,
    sql<{ id: string; plan_id: string; position: number; skill: string; opens_on: string | null }[]>`
      select id, plan_id, position, skill, opens_on from wp_weeks order by plan_id, position`,
    sql<{ id: string; week_id: string; position: number; title: string; n: number }[]>`
      select l.id, l.week_id, l.position, l.title,
             (select count(*)::int from wp_questions q where q.lesson_id = l.id and q.deleted_at is null) as n
      from wp_lessons l order by l.week_id, l.position`,
  ]);
  const weeksOf = (planId: string): PlanWeek[] => weeks.filter((w) => w.plan_id === planId).map((w) => ({
    id: w.id, position: w.position, skill: w.skill, opensOn: w.opens_on, weekday: w.opens_on ? weekdayName(w.opens_on) : '',
    lessons: lessons.filter((l) => l.week_id === w.id).map((l) => ({ id: l.id, position: l.position, title: l.title, questionCount: l.n })),
  }));
  return classes.map((c) => ({
    id: c.id, name: c.name, grade: c.grade,
    plans: assigned.filter((a) => a.class_id === c.id).map((a) => ({ id: a.plan_id, title: a.title, weeks: weeksOf(a.plan_id) })),
  }));
}

export const SKILL_MAX = 60;

/** Edits a week's skill (1-60 characters, trimmed) and open date (a real YYYY-MM-DD, Seoul). */
export async function setWeek(weekId: string, input: { skill: string; opensOn: string }): Promise<void> {
  const skill = String(input.skill ?? '').trim();
  const opensOn = String(input.opensOn ?? '').trim();
  const problems: string[] = [];
  if (skill.length < 1) problems.push('Skill: write a short name for the week.');
  else if (skill.length > SKILL_MAX) problems.push(`Skill: keep it to ${SKILL_MAX} characters or fewer.`);
  if (!isRealDate(opensOn)) problems.push('Opens on: pick a real date.');
  if (problems.length) throw new EditorError(problems);
  if (!UUID_RE.test(weekId)) throw new NotFoundError('week not found');
  const rows = await sql`update wp_weeks set skill = ${skill}, opens_on = ${opensOn} where id = ${weekId} returning id`;
  if (rows.length === 0) throw new NotFoundError('week not found');
}

export interface EditorQuestion {
  id: string; position: number; type: string;
  /** null when the stored payload no longer passes validation: the list says so and offers Delete */
  question: Question | null;
}
export interface EditorLesson {
  lesson: { id: string; title: string; position: number };
  week: { id: string; position: number; skill: string };
  plan: { id: string; title: string };
  questions: EditorQuestion[];
}

/** A lesson with its non-deleted questions in order, or null for an unknown id. */
export async function getEditorLesson(lessonId: string): Promise<EditorLesson | null> {
  if (!UUID_RE.test(lessonId)) return null;
  const [row] = await sql<{ id: string; title: string; position: number; week_id: string; week_position: number; skill: string; plan_id: string; plan_title: string }[]>`
    select l.id, l.title, l.position, w.id as week_id, w.position as week_position, w.skill, p.id as plan_id, p.title as plan_title
    from wp_lessons l join wp_weeks w on w.id = l.week_id join wp_plans p on p.id = w.plan_id
    where l.id = ${lessonId}`;
  if (!row) return null;
  const qs = await sql<{ id: string; position: number; type: string; payload: unknown }[]>`
    select id, position, type, payload from wp_questions
    where lesson_id = ${lessonId} and deleted_at is null order by position, id`;
  return {
    lesson: { id: row.id, title: row.title, position: row.position },
    week: { id: row.week_id, position: row.week_position, skill: row.skill },
    plan: { id: row.plan_id, title: row.plan_title },
    questions: qs.map((q) => {
      let question: Question | null = null;
      try { question = parseQuestion(q.type, q.payload); } catch { /* shown as a problem in the list */ }
      return { id: q.id, position: q.position, type: q.type, question };
    }),
  };
}

export interface SaveDeps { audio?: () => Promise<AudioDeps> }
export interface SaveResult { id: string; audio: 'ok' | 'failed' }

const VIDEO_PROBLEM = {
  not_found: "Video: Blobby couldn't find that video. Check the link.",
  not_embeddable: "Video: This video can't be played inside Blobby. Try another link.",
  unreachable: "Video: Couldn't check the video right now. Try again.",
} as const;

/**
 * Saves one question. Validates first (EditorError with readable problems), writes the question, and only then makes
 * audio, best effort: if the voice service or Storage is unavailable the save still stands and `audio` is 'failed'.
 * An existing question at `position` is updated in place (same id, so attempts stay valid); otherwise the question
 * is added after the last one.
 */
export async function saveQuestion(
  lessonId: string, position: number, type: string, payload: unknown, deps: SaveDeps = {},
): Promise<SaveResult> {
  if (!UUID_RE.test(lessonId)) throw new NotFoundError('lesson not found');
  const [lesson] = await sql`select id from wp_lessons where id = ${lessonId}`;
  if (!lesson) throw new NotFoundError('lesson not found');

  let body = payload;
  let videoId: string | null = null;
  if (type === 'watch_answer' && payload && typeof payload === 'object') {
    videoId = parseYouTubeId(String((payload as { youtubeId?: unknown }).youtubeId ?? ''));
    body = { ...(payload as object), youtubeId: videoId ?? '' };
  }
  const problems = questionProblems(type, body);
  if (problems.length) throw new EditorError(problems);
  if (videoId) {
    const check = await checkEmbeddable(videoId);
    if (!check.ok) throw new EditorError([check.reason === 'bad_url' ? 'Video: paste a YouTube link or the 11-character video id.' : VIDEO_PROBLEM[check.reason]]);
  }
  const q = parseQuestion(type, body);
  const { type: t, ...stored } = q;

  const { id, previous } = await sql.begin(async (tx) => {
    const [existing] = await tx<{ id: string; audio: unknown }[]>`
      select id, audio from wp_questions
      where lesson_id = ${lessonId} and position = ${position} and deleted_at is null order by updated_at desc limit 1`;
    if (existing) {
      await tx`update wp_questions set type = ${t}, payload = ${tx.json(stored as never)}, updated_at = now() where id = ${existing.id}`;
      return { id: existing.id, previous: existing.audio };
    }
    const [{ next }] = await tx<{ next: number }[]>`
      select coalesce(max(position), 0)::int + 1 as next from wp_questions where lesson_id = ${lessonId} and deleted_at is null`;
    const [row] = await tx<{ id: string }[]>`
      insert into wp_questions (lesson_id, position, type, payload) values (${lessonId}, ${next}, ${t}, ${tx.json(stored as never)}) returning id`;
    return { id: row.id, previous: {} };
  });

  let audio: Record<string, string>;
  let status: 'ok' | 'failed' = 'ok';
  try {
    audio = await ensureAudio(q, await (deps.audio ?? defaultAudioDeps)());
  } catch {
    // Keep sound for every string that is still spoken; a changed string simply has none until audio works again.
    const old = previous && typeof previous === 'object' ? (previous as Record<string, unknown>) : {};
    audio = Object.fromEntries(spokenStrings(q).filter((s) => typeof old[s] === 'string').map((s) => [s, old[s] as string]));
    status = 'failed';
  }
  await sql`update wp_questions set audio = ${sql.json(audio as never)} where id = ${id}`;
  return { id, audio: status };
}

/** Hides a question from the editor, lessons and free practice. The row and its attempts stay (stats still count them). */
export async function softDeleteQuestion(id: string): Promise<void> {
  if (!UUID_RE.test(id)) throw new NotFoundError('question not found');
  const rows = await sql`update wp_questions set deleted_at = coalesce(deleted_at, now()) where id = ${id} returning id`;
  if (rows.length === 0) throw new NotFoundError('question not found');
}
