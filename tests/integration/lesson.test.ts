import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resetTestDb, TEST_DATABASE_URL } from './helpers/db';
import { seed, CLASS, STUDENTS } from '../e2e/fixtures/seed';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.SESSION_SECRET = 'int-secret';

let sql: Awaited<ReturnType<typeof resetTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = new Date('2026-01-10T03:00:00Z'); // Seoul 2026-01-10

const PLAN = id(100), OTHER_PLAN = id(101);
const W1 = id(200), WFUT = id(201), WNULL = id(202), WOTHER = id(203);
const L1 = id(300), L2 = id(301), LFUT = id(302), LNULL = id(303), LOTHER = id(304);
const Q = { a: id(400), b: id(401), deleted: id(402), c: id(403), fut: id(404) };
const [MINA, LEO] = [STUDENTS.mina.id, STUDENTS.leo.id];

const pickOne = (prompt: string) => ({ prompt, choices: ['yes', 'no'], answer: 0 });

beforeAll(async () => {
  sql = await resetTestDb();
  await seed(sql);
  await sql`insert into wp_plans (id, title, kind) values (${PLAN}, 'Winter', 'winter'), (${OTHER_PLAN}, 'Other', 'test')`;
  await sql`insert into wp_plan_assignments (plan_id, class_id) values (${PLAN}, ${CLASS.id})`;
  await sql`insert into wp_weeks (id, plan_id, position, skill, opens_on) values
    (${W1}, ${PLAN}, 1, 'Past tense', '2026-01-01'),
    (${WFUT}, ${PLAN}, 2, 'Future', '2026-02-01'),
    (${WNULL}, ${PLAN}, 3, 'Null', null),
    (${WOTHER}, ${OTHER_PLAN}, 1, 'Other', '2026-01-01')`;
  await sql`insert into wp_lessons (id, week_id, position, title) values
    (${L1}, ${W1}, 1, 'Yesterday'), (${L2}, ${W1}, 2, 'Today'),
    (${LFUT}, ${WFUT}, 1, 'Later'), (${LNULL}, ${WNULL}, 1, 'Never'), (${LOTHER}, ${WOTHER}, 1, 'Other')`;
  await sql`insert into wp_questions (id, lesson_id, position, type, payload, audio, deleted_at) values
    (${Q.b}, ${L1}, 2, 'pick_one', ${sql.json(pickOne('second'))}, ${sql.json({ second: 'https://x/2.mp3', bad: 7 })}, null),
    (${Q.a}, ${L1}, 1, 'pick_one', ${sql.json(pickOne('first'))}, '{}', null),
    (${Q.deleted}, ${L1}, 3, 'pick_one', ${sql.json(pickOne('gone'))}, '{}', now()),
    (${Q.c}, ${L2}, 1, 'pick_one', ${sql.json(pickOne('third'))}, '{}', null),
    (${Q.fut}, ${LFUT}, 1, 'pick_one', ${sql.json(pickOne('later'))}, '{}', null)`;
});
afterAll(async () => {
  await sql.end();
});

describe('getLesson', () => {
  it('returns the non-deleted questions in order, with the lesson, week and kid', async () => {
    const { getLesson } = await import('@/lib/db/kid');
    const l = await getLesson(LEO, L1, NOW);
    expect(l.student).toEqual({ id: LEO, displayName: 'Leo', blobColor: 'mint', grade: CLASS.grade });
    expect(l.totalStars).toBe(0);
    expect(l.lesson).toEqual({ id: L1, title: 'Yesterday', position: 1 });
    expect(l.week).toEqual({ id: W1, number: 1, skill: 'Past tense', lessonCount: 2, done: false });
    expect(l.lessonDone).toBe(false);
    expect(l.otherLessonsDone).toBe(false);
    expect(l.questions.map((q) => q.id)).toEqual([Q.a, Q.b]); // soft-deleted one excluded
    expect(l.questions[0].question).toEqual({ type: 'pick_one', ...pickOne('first') });
    expect(l.questions[1].audio).toEqual({ second: 'https://x/2.mp3' }); // non-string urls dropped
  });

  it('tracks lessonDone, otherLessonsDone and week done for this kid only', async () => {
    const { getLesson, completeLesson } = await import('@/lib/db/kid');
    await completeLesson(LEO, L2, NOW);
    let l = await getLesson(LEO, L1, NOW);
    expect([l.lessonDone, l.otherLessonsDone, l.week.done, l.totalStars]).toEqual([false, true, false, 10]);
    await completeLesson(LEO, L1, NOW);
    l = await getLesson(LEO, L1, NOW);
    expect([l.lessonDone, l.otherLessonsDone, l.week.done, l.totalStars]).toEqual([true, true, true, 30]);
    const m = await getLesson(MINA, L1, NOW);
    expect([m.lessonDone, m.otherLessonsDone, m.week.done, m.totalStars]).toEqual([false, false, false, 0]);
    expect(m.student.blobColor).toBeNull();
  });

  it('refuses locked weeks (dated or null), unassigned plans and bad ids with NotFoundError', async () => {
    const { getLesson, NotFoundError } = await import('@/lib/db/kid');
    for (const lessonId of [LFUT, LNULL, LOTHER, id(999), 'not-a-uuid']) {
      await expect(getLesson(LEO, lessonId, NOW)).rejects.toBeInstanceOf(NotFoundError);
    }
    // the future week opens on its date
    expect((await getLesson(LEO, LFUT, new Date('2026-02-01T00:00:00Z'))).questions).toHaveLength(1);
  });

  it('flags exactly one class question as the bonus and keeps it across reloads', async () => {
    const { getLesson } = await import('@/lib/db/kid');
    const first = await getLesson(LEO, L1, NOW);
    const bonus = first.questions.filter((q) => q.bonus);
    expect(bonus).toHaveLength(1);
    expect(bonus[0].forYou).toBeFalsy();
    const again = await getLesson(LEO, L1, NOW);
    expect(again.questions.find((q) => q.bonus)!.id).toBe(bonus[0].id);
    const [row] = await sql<{ bonus_question_id: string }[]>`select bonus_question_id from wp_review_picks where student_id = ${LEO} and lesson_id = ${L1}`;
    expect(row.bonus_question_id).toBe(bonus[0].id);
  });

  it('keeps the stored bonus when a question is added before it, and repicks when the stored one is deleted', async () => {
    const { getLesson } = await import('@/lib/db/kid');
    const { pickLessonBonus, lessonBonusSeed } = await import('@/lib/bonus');
    const bonusOf = async () => (await getLesson(MINA, L1, NOW)).questions.filter((q) => q.bonus).map((q) => q.id);
    const [before] = await bonusOf();
    const [first, last] = [id(405), id(406)];
    await sql`insert into wp_questions (id, lesson_id, position, type, payload, audio) values
      (${first}, ${L1}, 0, 'pick_one', ${sql.json(pickOne('zeroth'))}, '{}'),
      (${last}, ${L1}, 9, 'pick_one', ${sql.json(pickOne('ninth'))}, '{}')`;
    try {
      // a fresh pick over the new list would land elsewhere, so only the stored pick keeps it
      expect(pickLessonBonus([first, Q.a, Q.b, last], lessonBonusSeed(MINA, L1, false))).not.toBe(before);
      expect(await bonusOf()).toEqual([before]);
      await sql`update wp_questions set deleted_at = now() where id = ${before}`;
      const after = await bonusOf();
      expect(after).toHaveLength(1);
      expect(after[0]).not.toBe(before);
      expect([first, Q.a, Q.b, last]).toContain(after[0]);
      const [row] = await sql<{ bonus_question_id: string }[]>`select bonus_question_id from wp_review_picks where student_id = ${MINA} and lesson_id = ${L1}`;
      expect(row.bonus_question_id).toBe(after[0]);
    } finally {
      if (before) await sql`update wp_questions set deleted_at = null where id = ${before}`;
      await sql`update wp_review_picks set bonus_question_id = null where bonus_question_id in (${first}, ${last})`;
      await sql`delete from wp_questions where id in (${first}, ${last})`;
    }
  });
});

describe('getWeekDone', () => {
  it('sums this week’s lesson and bonus stars, plus the running total', async () => {
    const { getWeekDone, recordAttempt } = await import('@/lib/db/kid');
    // a free-practice star elsewhere counts toward the total but not the week
    await recordAttempt(LEO, { clientAttemptId: id(700), questionId: Q.a, correct: true, context: 'free' }, NOW);
    const w = await getWeekDone(LEO, W1, NOW);
    expect(w).toEqual({
      student: { id: LEO, displayName: 'Leo', blobColor: 'mint' },
      week: { id: W1, number: 1, skill: 'Past tense', done: true },
      weekStars: 30,
      totalStars: 31,
    });
    const m = await getWeekDone(MINA, W1, NOW);
    expect(m.week.done).toBe(false);
    expect(m.weekStars).toBe(0);
  });

  it('refuses locked or unassigned weeks', async () => {
    const { getWeekDone, NotFoundError } = await import('@/lib/db/kid');
    for (const weekId of [WFUT, WNULL, WOTHER, 'nope']) {
      await expect(getWeekDone(LEO, weekId, NOW)).rejects.toBeInstanceOf(NotFoundError);
    }
  });
});

describe('getHome week numbers', () => {
  it('exposes each week’s position as number', async () => {
    const { getHome } = await import('@/lib/db/kid');
    expect((await getHome(LEO, NOW)).weeks.map((w) => w.number)).toEqual([1, 2, 3]);
  });
});
