import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resetTestDb, TEST_DATABASE_URL } from './helpers/db';
import { seed, seedPlan, CLASS, STUDENTS, PLAN } from '../e2e/fixtures/seed';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.SESSION_SECRET = 'int-secret';

const UNDATED_WEEK = '00000000-0000-4000-8000-00000000f501';
const UNDATED_LESSON = '00000000-0000-4000-8000-00000000f502';

let sql: Awaited<ReturnType<typeof resetTestDb>>;
let practiceId: string;
beforeAll(async () => {
  sql = await resetTestDb();
  await seed(sql);
  await seedPlan(sql);
  await sql`insert into wp_weeks (id, plan_id, position, skill, opens_on) values (${UNDATED_WEEK}, ${PLAN.id}, 9, 'No date yet', null)`;
  await sql`insert into wp_lessons (id, week_id, position, title) values (${UNDATED_LESSON}, ${UNDATED_WEEK}, 1, 'Someday')`;
});
afterAll(async () => { await sql.end(); });

describe('practice student', () => {
  it('creates the practice student once', async () => {
    const { practiceStudentFor } = await import('@/lib/db/teacher');
    const [a, b] = await Promise.all([practiceStudentFor(CLASS.id), practiceStudentFor(CLASS.id)]);
    expect(a.id).toBe(b.id);
    expect(a.is_preview).toBe(true);
    expect(a.display_name).toBe('Teacher');
    const rows = await sql`select id from wp_students where class_id = ${CLASS.id} and is_preview`;
    expect(rows).toHaveLength(1);
    practiceId = a.id;
  });

  it('rejects an unknown class', async () => {
    const { practiceStudentFor } = await import('@/lib/db/teacher');
    await expect(practiceStudentFor('00000000-0000-4000-8000-00000000ffff')).rejects.toThrow();
    await expect(practiceStudentFor('nope')).rejects.toThrow();
  });

  it('is hidden from teacher lists', async () => {
    const { listClasses, classStats, cardsForClass } = await import('@/lib/db/teacher');
    expect((await listClasses()).find((c) => c.id === CLASS.id)!.kidCount).toBe(3);
    expect((await classStats(CLASS.id))!.rows.map((r) => r.studentId)).not.toContain(practiceId);
    expect((await cardsForClass(CLASS.id))!.students.map((s) => s.id)).not.toContain(practiceId);
  });

  it('is hidden from join', async () => {
    const { classByCode, studentForJoin } = await import('@/lib/db/kid');
    expect((await classByCode(CLASS.code))!.names.map((n) => n.id)).not.toContain(practiceId);
    expect(await studentForJoin(CLASS.code, practiceId)).toBeNull();
  });

  it('sees every week, dated in the future or not dated at all; real kids do not', async () => {
    const { getHome, getLesson, NotFoundError } = await import('@/lib/db/kid');
    const practice = await getHome(practiceId);
    for (const id of [PLAN.weeks.locked.id, PLAN.weeks.later.id, UNDATED_WEEK]) {
      expect(practice.weeks.find((w) => w.id === id)!.open).toBe(true);
    }
    const mina = await getHome(STUDENTS.mina.id);
    expect(mina.weeks.find((w) => w.id === PLAN.weeks.later.id)!.open).toBe(false);
    expect(mina.weeks.find((w) => w.id === UNDATED_WEEK)!.open).toBe(false);

    expect((await getLesson(practiceId, PLAN.lessons.later.id)).lesson.id).toBe(PLAN.lessons.later.id);
    await expect(getLesson(STUDENTS.mina.id, PLAN.lessons.later.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('can answer and finish a future lesson', async () => {
    const { recordAttempt, completeLesson, getWeek, getWeekDone, practiceAvailable } = await import('@/lib/db/kid');
    const q = await sql`select id from wp_questions where lesson_id = ${PLAN.lessons.later.id} limit 1`;
    await recordAttempt(practiceId, { clientAttemptId: crypto.randomUUID(), questionId: q[0].id, correct: false, context: 'lesson' });
    const r = await completeLesson(practiceId, PLAN.lessons.later.id);
    expect(r.starsAwarded).toBeGreaterThan(0);
    expect(await getWeek(practiceId, PLAN.weeks.later.id)).not.toBeNull();
    expect((await getWeekDone(practiceId, PLAN.weeks.later.id)).week.id).toBe(PLAN.weeks.later.id);
    expect(await practiceAvailable(practiceId)).toBe(true);
  });

  it('reset clears progress but keeps the student', async () => {
    const { setBlobColor } = await import('@/lib/db/kid');
    const { resetPracticeStudent } = await import('@/lib/db/teacher');
    await setBlobColor(practiceId, 'mint');
    await resetPracticeStudent(CLASS.id);
    for (const table of ['wp_attempts', 'wp_lesson_completions', 'wp_star_events', 'wp_practice_days']) {
      const rows = await sql.unsafe(`select 1 from ${table} where student_id = $1`, [practiceId]);
      expect(rows, table).toHaveLength(0);
    }
    const [s] = await sql`select blob_color, is_preview from wp_students where id = ${practiceId}`;
    expect(s).toEqual({ blob_color: null, is_preview: true });
  });

  it('reset leaves real kids alone', async () => {
    const { completeLesson } = await import('@/lib/db/kid');
    const { resetPracticeStudent } = await import('@/lib/db/teacher');
    await completeLesson(STUDENTS.leo.id, PLAN.lessons.one.id);
    await resetPracticeStudent(CLASS.id);
    const rows = await sql`select 1 from wp_lesson_completions where student_id = ${STUDENTS.leo.id}`;
    expect(rows).toHaveLength(1);
  });
});
