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

  it('never picks a watch_answer question as the bonus', async () => {
    const { getLesson } = await import('@/lib/db/kid');
    const { pickLessonBonus, lessonBonusSeed } = await import('@/lib/bonus');
    const watch = id(407);
    await sql`delete from wp_review_picks where student_id = ${MINA} and lesson_id = ${L1}`;
    await sql`update wp_questions set deleted_at = now() where id = ${Q.b}`;
    await sql`insert into wp_questions (id, lesson_id, position, type, payload, audio) values
      (${watch}, ${L1}, 0, 'watch_answer', ${sql.json({ youtubeId: 'dQw4w9WgXcQ', questions: [{ type: 'pick_one', ...pickOne('seen it') }] })}, '{}')`;
    try {
      const bonusOf = async () => (await getLesson(MINA, L1, NOW)).questions.filter((q) => q.bonus);
      // an unfiltered fresh pick over [watch, Q.a] would choose the watch_answer
      expect(pickLessonBonus([watch, Q.a], lessonBonusSeed(MINA, L1, false))).toBe(watch);
      expect((await bonusOf()).map((q) => q.id)).toEqual([Q.a]);
      // a stored watch_answer bonus is not kept either
      await sql`update wp_review_picks set bonus_question_id = ${watch} where student_id = ${MINA} and lesson_id = ${L1}`;
      const again = await bonusOf();
      expect(again.map((q) => q.id)).toEqual([Q.a]);
      expect(again[0].question.type).not.toBe('watch_answer');
    } finally {
      await sql`update wp_questions set deleted_at = null where id = ${Q.b}`;
      await sql`update wp_review_picks set bonus_question_id = null where bonus_question_id = ${watch}`;
      await sql`delete from wp_questions where id = ${watch}`;
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

describe('lesson bonus', () => {
  // Jun is untouched by the tests above: each test starts him on a fresh L1/L2 with no stars.
  const JUN = STUDENTS.jun.id;
  const fresh = async () => {
    await sql`delete from wp_lesson_completions where student_id = ${JUN}`;
    await sql`delete from wp_star_events where student_id = ${JUN}`;
    await sql`delete from wp_review_picks where student_id = ${JUN}`;
  };
  const bonusOf = async () => {
    const { getLesson } = await import('@/lib/db/kid');
    const [q] = (await getLesson(JUN, L1, NOW)).questions.filter((x) => x.bonus);
    return q.id;
  };
  const answer = async (n: number, questionId: string, correct: boolean, runId: string) => {
    const { recordAttempt } = await import('@/lib/db/kid');
    await recordAttempt(JUN, { clientAttemptId: id(n), questionId, correct, context: 'lesson', runId }, NOW);
  };
  const other = (q: string) => (q === Q.a ? Q.b : Q.a);

  it('pays +2 once when the run’s first attempt at the stored bonus was right', async () => {
    const { completeLesson } = await import('@/lib/db/kid');
    await fresh();
    const RUN = id(901);
    const bonus = await bonusOf();
    await answer(911, bonus, true, RUN);
    const res = await completeLesson(JUN, L1, NOW, RUN);
    // L2 is not done, so no week bonus: 10 + 2
    expect(res).toEqual({ starsAwarded: 12, weekDone: false, lessonStars: 10, bonusStars: 2 });
    const ev = await sql`select amount, plan_id from wp_star_events where student_id = ${JUN} and reason = 'lesson_bonus' and ref_id = ${L1}`;
    expect(ev).toHaveLength(1);
    expect(ev[0].amount).toBe(2);
    expect(ev[0].plan_id).toBe(PLAN); // covered by the test-star reset, which deletes by plan_id
    const again = await completeLesson(JUN, L1, NOW, RUN);
    expect(again).toEqual({ starsAwarded: 0, weekDone: false, lessonStars: 0, bonusStars: 0 });
  });

  it('pays nothing when the first attempt was wrong, even if a later one was right', async () => {
    const { completeLesson } = await import('@/lib/db/kid');
    await fresh();
    const RUN = id(902);
    const bonus = await bonusOf();
    // the previous test's run got this question right first; only this run's attempts count
    await answer(921, bonus, false, RUN);
    await answer(922, bonus, true, RUN);
    const res = await completeLesson(JUN, L1, NOW, RUN);
    expect(res).toEqual({ starsAwarded: 10, weekDone: false, lessonStars: 10, bonusStars: 0 });
    expect(await sql`select 1 from wp_star_events where student_id = ${JUN} and reason = 'lesson_bonus'`).toHaveLength(0);
  });

  it('pays nothing without a runId, or when the run never answered the bonus', async () => {
    const { completeLesson } = await import('@/lib/db/kid');
    await fresh();
    const RUN = id(903);
    await answer(931, await bonusOf(), true, RUN);
    expect((await completeLesson(JUN, L1, NOW)).bonusStars).toBe(0);

    await fresh();
    const RUN2 = id(904);
    await answer(941, other(await bonusOf()), true, RUN2);
    const res = await completeLesson(JUN, L1, NOW, RUN2);
    expect([res.lessonStars, res.bonusStars, res.starsAwarded]).toEqual([10, 0, 10]);
    expect(await sql`select 1 from wp_star_events where student_id = ${JUN} and reason = 'lesson_bonus'`).toHaveLength(0);
  });

  it('pays nothing on a redo (the lesson was already complete)', async () => {
    const { completeLesson } = await import('@/lib/db/kid');
    await fresh();
    await bonusOf();
    await completeLesson(JUN, L1, NOW);
    const RUN = id(905);
    await answer(951, await bonusOf(), true, RUN); // the redo's own stored pick
    const res = await completeLesson(JUN, L1, NOW, RUN);
    expect(res).toEqual({ starsAwarded: 0, weekDone: false, lessonStars: 0, bonusStars: 0 });
    expect(await sql`select 1 from wp_star_events where student_id = ${JUN} and reason = 'lesson_bonus'`).toHaveLength(0);
  });

  it('pays the stored question even after it was soft-deleted mid-run', async () => {
    const { completeLesson } = await import('@/lib/db/kid');
    await fresh();
    const RUN = id(906);
    const bonus = await bonusOf();
    await answer(961, bonus, true, RUN);
    await sql`update wp_questions set deleted_at = now() where id = ${bonus}`;
    try {
      const res = await completeLesson(JUN, L1, NOW, RUN);
      expect(res.bonusStars).toBe(2);
      expect(res.starsAwarded).toBe(12);
    } finally {
      await sql`update wp_questions set deleted_at = null where id = ${bonus}`;
    }
  });

  it('pays the stored question, not a positional repick, after a question was inserted before it', async () => {
    const { completeLesson } = await import('@/lib/db/kid');
    const { pickLessonBonus, lessonBonusSeed } = await import('@/lib/bonus');
    await fresh();
    const RUN = id(907);
    const bonus = await bonusOf();
    const first = id(408);
    await sql`insert into wp_questions (id, lesson_id, position, type, payload, audio) values
      (${first}, ${L1}, 0, 'pick_one', ${sql.json(pickOne('zeroth'))}, '{}')`;
    try {
      // a fresh pick over the new list would land elsewhere, so only the stored pick pays
      expect(pickLessonBonus([first, Q.a, Q.b], lessonBonusSeed(JUN, L1, false))).not.toBe(bonus);
      await answer(971, bonus, true, RUN);
      const res = await completeLesson(JUN, L1, NOW, RUN);
      expect(res.bonusStars).toBe(2);
    } finally {
      await sql`delete from wp_questions where id = ${first}`;
    }
  });

  it('getWeekDone.weekStars includes lesson bonus stars', async () => {
    const { completeLesson, getWeekDone } = await import('@/lib/db/kid');
    await fresh();
    const RUN = id(908);
    await answer(981, await bonusOf(), true, RUN);
    expect((await completeLesson(JUN, L1, NOW, RUN)).bonusStars).toBe(2);
    const res = await completeLesson(JUN, L2, NOW);
    expect(res).toEqual({ starsAwarded: 20, weekDone: true, lessonStars: 10, bonusStars: 0 });
    // L1 10 + bonus 2 + L2 10 + week bonus 10
    expect((await getWeekDone(JUN, W1, NOW)).weekStars).toBe(32);
  });
});
