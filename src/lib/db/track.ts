import 'server-only';
import type postgres from 'postgres';
import { sql } from './admin';
import { parseQuestion } from '../questions/schema';
import { isSkillKey, type SkillKey } from '../skills';
import { pickLessonBonus } from '../bonus';
import { afterLesson, chooseReview, dueSkills, type BankItem, type RunAnswer, type TrackSkill } from '../track';
import type { WpStudentSkill } from '../types';
import type { LessonQuestion } from './kid';

type Tx = postgres.TransactionSql | typeof sql;

/** After how many class questions the "just for you" questions go (fewer class questions: they go at the end). */
const REVIEW_SLOTS = [4, 8, 12];

function audioMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) for (const [k, v] of Object.entries(raw)) if (typeof v === 'string' && v) out[k] = v;
  return out;
}

function toTrack(r: WpStudentSkill): TrackSkill | null {
  if (!isSkillKey(r.skill)) return null;
  return { skill: r.skill, source: r.source, state: r.state, spacing: r.spacing, lessonsSince: r.lessons_since, removedByTeacher: r.removed_by_teacher, addedAt: new Date(r.added_at).toISOString() };
}

export async function loadTrack(tx: Tx, studentId: string): Promise<TrackSkill[]> {
  const rows = await tx<WpStudentSkill[]>`select * from wp_student_skills where student_id = ${studentId}`;
  return rows.map(toTrack).filter((x): x is TrackSkill => x !== null);
}

async function saveTrack(tx: Tx, studentId: string, before: TrackSkill[], after: TrackSkill[]): Promise<void> {
  const old = new Map(before.map((s) => [s.skill, JSON.stringify(s)]));
  for (const s of after) {
    if (old.get(s.skill) === JSON.stringify(s)) continue;
    await tx`
      insert into wp_student_skills (student_id, skill, source, state, spacing, lessons_since, removed_by_teacher, added_at, changed_at)
      values (${studentId}, ${s.skill}, ${s.source}, ${s.state}, ${s.spacing}, ${s.lessonsSince}, ${s.removedByTeacher}, ${s.addedAt}, now())
      on conflict (student_id, skill) do update set state = excluded.state, spacing = excluded.spacing,
        lessons_since = excluded.lessons_since, changed_at = now()`;
  }
}

/**
 * The kid's due review questions for one lesson, chosen from their grade's bank. The choice is saved per kid and
 * lesson, so answering one and reloading shows the same questions; finishing the lesson clears it (forgetPicks).
 * It is chosen again only if a saved question stopped being valid (deleted, or its skill no longer due).
 */
export async function reviewQuestions(studentId: string, grade: number, lessonId: string, seed: string): Promise<LessonQuestion[]> {
  const due = dueSkills(await loadTrack(sql, studentId));
  if (due.length === 0) return [];
  const rows = await sql<{ id: string; skill: string; type: string; payload: unknown; audio: unknown; correct: boolean | null; seen: string | null }[]>`
    select q.id, q.skill, q.type, q.payload, q.audio, last.correct, last.created_at::text as seen
    from wp_questions q
    left join lateral (
      select a.correct, a.created_at from wp_attempts a where a.question_id = q.id and a.student_id = ${studentId}
      order by a.created_at desc limit 1
    ) last on true
    where q.bank_grade = ${grade} and q.skill = any(${due}::text[]) and q.deleted_at is null
    order by q.skill, q.position`;
  const bank = new Map<SkillKey, BankItem[]>();
  const byId = new Map<string, LessonQuestion>();
  for (const r of rows) {
    if (!isSkillKey(r.skill)) continue;
    try {
      const question = parseQuestion(r.type, r.payload);
      if (question.type === 'watch_answer') continue;
      byId.set(r.id, { id: r.id, question, audio: audioMap(r.audio), skill: r.skill, forYou: true });
    } catch { continue; }
    const list = bank.get(r.skill) ?? [];
    list.push({ id: r.id, lastAnswer: r.correct === null ? null : r.correct ? 'right' : 'missed', lastSeen: r.seen });
    bank.set(r.skill, list);
  }
  const [saved] = await sql<{ question_ids: string[] }[]>`
    select question_ids from wp_review_picks where student_id = ${studentId} and lesson_id = ${lessonId}`;
  if (saved && saved.question_ids.length > 0 && saved.question_ids.every((id) => byId.has(id))) {
    return saved.question_ids.map((id) => byId.get(id)!);
  }
  const ids = chooseReview(due, bank, seed);
  if (ids.length > 0) {
    await sql`
      insert into wp_review_picks (student_id, lesson_id, question_ids) values (${studentId}, ${lessonId}, ${ids}::uuid[])
      on conflict (student_id, lesson_id) do update set question_ids = excluded.question_ids, picked_at = now()`;
  }
  return ids.map((id) => byId.get(id)!);
}

/**
 * The kid's bonus question for one lesson, picked among its class questions and saved with the lesson's picks, so a
 * reload (or a question added to the lesson) keeps it; picked again only if the saved one is no longer in the lesson.
 */
export async function bonusPick(studentId: string, lessonId: string, classQuestionIds: string[], seed: string): Promise<string | null> {
  const pick = pickLessonBonus(classQuestionIds, seed);
  if (pick === null) return null;
  const stored = await storedBonus(sql, studentId, lessonId);
  if (stored !== null && classQuestionIds.includes(stored)) return stored;
  await sql`
    insert into wp_review_picks (student_id, lesson_id, question_ids, bonus_question_id)
    values (${studentId}, ${lessonId}, '{}', ${pick})
    on conflict (student_id, lesson_id) do update set bonus_question_id = excluded.bonus_question_id`;
  return pick;
}

/** The bonus question saved for the kid's current play-through of a lesson, if any. */
export async function storedBonus(tx: Tx, studentId: string, lessonId: string): Promise<string | null> {
  const [row] = await tx<{ bonus_question_id: string | null }[]>`
    select bonus_question_id from wp_review_picks where student_id = ${studentId} and lesson_id = ${lessonId}`;
  return row?.bonus_question_id ?? null;
}

/** A finished lesson's next play-through picks its "just for you" questions afresh. */
export async function forgetPicks(tx: Tx, studentId: string, lessonId: string): Promise<void> {
  await tx`delete from wp_review_picks where student_id = ${studentId} and lesson_id = ${lessonId}`;
}

/** Class questions with the review questions placed after class questions 4, 8 and 12. */
export function mixIn(cls: LessonQuestion[], review: LessonQuestion[]): LessonQuestion[] {
  const out: LessonQuestion[] = [];
  const slots = REVIEW_SLOTS.map((n) => Math.min(n, cls.length));
  let r = 0;
  cls.forEach((q, i) => {
    out.push(q);
    while (r < review.length && slots[r] === i + 1) out.push(review[r++]);
  });
  while (r < review.length) out.push(review[r++]);
  return out;
}

/** Updates the kid's track from one finished lesson run, at most once per run. */
export async function countRun(tx: Tx, studentId: string, runId: string, now: Date): Promise<void> {
  const [fresh] = await tx`insert into wp_track_runs (student_id, run_id) values (${studentId}, ${runId}) on conflict do nothing returning run_id`;
  if (!fresh) return;
  const answers = await tx<{ skill: string; correct: boolean; bank: boolean }[]>`
    select q.skill, a.correct, (q.bank_grade is not null) as bank
    from wp_attempts a join wp_questions q on q.id = a.question_id
    where a.student_id = ${studentId} and a.run_id = ${runId} and q.skill is not null
    order by a.created_at`;
  const run: RunAnswer[] = answers.filter((a) => isSkillKey(a.skill)).map((a) => ({ skill: a.skill as SkillKey, right: a.correct }));
  const shown = [...new Set(answers.filter((a) => a.bank && isSkillKey(a.skill)).map((a) => a.skill as SkillKey))];
  const before = await loadTrack(tx, studentId);
  const skills = [...new Set([...run.map((a) => a.skill), ...before.map((s) => s.skill)])];
  const recentRows = await tx<{ skill: string; correct: boolean }[]>`
    select skill, correct from (
      select q.skill, a.correct, a.created_at, row_number() over (partition by q.skill order by a.created_at desc) as rn
      from wp_attempts a join wp_questions q on q.id = a.question_id
      where a.student_id = ${studentId} and q.skill = any(${skills}::text[])
    ) x where rn <= 6 order by skill, created_at`;
  const recent = new Map<SkillKey, boolean[]>();
  for (const r of recentRows) if (isSkillKey(r.skill)) recent.set(r.skill, [...(recent.get(r.skill) ?? []), r.correct]);
  const after = afterLesson(before, run, recent, shown, now.toISOString());
  await saveTrack(tx, studentId, before, after);
}

/** Practice again: up to 5 questions on one skill: the kid's missed ones first, then the bank, then open class questions. */
export async function skillPractice(studentId: string, grade: number, skill: SkillKey, openClassQuestionIds: Set<string>, missed: Set<string>): Promise<LessonQuestion[]> {
  const rows = await sql<{ id: string; type: string; payload: unknown; audio: unknown; bank: boolean; seen: boolean }[]>`
    select q.id, q.type, q.payload, q.audio, (q.bank_grade is not null) as bank,
      exists(select 1 from wp_attempts a where a.question_id = q.id and a.student_id = ${studentId}) as seen
    from wp_questions q
    where q.skill = ${skill} and q.deleted_at is null and q.type <> 'watch_answer'
      and (q.bank_grade = ${grade} or q.id = any(${[...openClassQuestionIds]}::uuid[]))
    order by q.position, q.id`;
  const rank = (r: { id: string; bank: boolean; seen: boolean }) => (missed.has(r.id) ? 0 : r.bank ? (r.seen ? 2 : 1) : 3);
  const out: LessonQuestion[] = [];
  for (const r of [...rows].sort((a, b) => rank(a) - rank(b))) {
    try { out.push({ id: r.id, question: parseQuestion(r.type, r.payload), audio: audioMap(r.audio), skill, forYou: r.bank }); }
    catch { continue; }
    if (out.length >= 5) break;
  }
  return out;
}
