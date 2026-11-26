import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resetTestDb, TEST_DATABASE_URL } from './helpers/db';
import { seed, CLASS, STUDENTS } from '../e2e/fixtures/seed';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.SESSION_SECRET = 'int-secret';

let sql: Awaited<ReturnType<typeof resetTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = new Date('2026-01-10T03:00:00Z'); // Seoul 2026-01-10 12:00

const P = { plan: id(100), other: id(101), unassignedLesson: id(0) };
const W1 = id(200), W2 = id(201), WFUT = id(202), WEMPTY = id(203), WOTHER = id(204);
const L = { a: id(300), b: id(301), c: id(302), solo: id(303), fut: id(304), other: id(305) };
const Q = { a1: id(400), a2: id(401), b1: id(402), fut: id(403), other: id(404) };
const [MINA, LEO, JUN] = [STUDENTS.mina.id, STUDENTS.leo.id, STUDENTS.jun.id];

beforeAll(async () => {
  sql = await resetTestDb();
  await seed(sql);
  await sql`insert into wp_plans (id, title, kind, created_at) values (${P.plan}, 'Winter', 'winter', '2026-01-01'), (${P.other}, 'Elsewhere', 'test', '2026-01-02')`;
  // class-assigned plan; the other plan is assigned to nobody
  await sql`insert into wp_plan_assignments (plan_id, class_id) values (${P.plan}, ${CLASS.id})`;
  await sql`insert into wp_weeks (id, plan_id, position, skill, opens_on) values
    (${W1}, ${P.plan}, 1, 'nouns', '2026-01-01'),
    (${W2}, ${P.plan}, 2, 'verbs', '2026-01-05'),
    (${WFUT}, ${P.plan}, 3, 'future', '2026-02-01'),
    (${WEMPTY}, ${P.plan}, 4, 'empty', '2026-01-02'),
    (${WOTHER}, ${P.other}, 1, 'other', '2026-01-01')`;
  await sql`insert into wp_lessons (id, week_id, position, title) values
    (${L.a}, ${W1}, 1, 'A'), (${L.b}, ${W1}, 2, 'B'), (${L.c}, ${W1}, 3, 'C'),
    (${L.solo}, ${W2}, 1, 'Solo'), (${L.fut}, ${WFUT}, 1, 'Future'), (${L.other}, ${WOTHER}, 1, 'Other')`;
  await sql`insert into wp_questions (id, lesson_id, position, type, payload) values
    (${Q.a1}, ${L.a}, 1, 'pick', '{}'), (${Q.a2}, ${L.a}, 2, 'pick', '{}'), (${Q.b1}, ${L.b}, 1, 'pick', '{}'),
    (${Q.fut}, ${L.fut}, 1, 'pick', '{}'), (${Q.other}, ${L.other}, 1, 'pick', '{}')`;
  await sql`insert into wp_star_events (student_id, plan_id, amount, reason, ref_id) values (${MINA}, ${P.other}, 99, 'free_correct', ${id(999)})`;
});
afterAll(async () => {
  await sql.end();
});

const count = async (table: string, student: string) =>
  Number((await sql.unsafe(`select count(*)::int as n from ${table} where student_id = $1`, [student]))[0].n);
const stars = async (student: string) =>
  Number((await sql`select coalesce(sum(amount),0)::int as n from wp_star_events where student_id = ${student} and amount <> 99`)[0].n);

describe('completeLesson', () => {
  it('awards 10 then 0 on a repeat', async () => {
    const { completeLesson } = await import('@/lib/db/kid');
    expect(await completeLesson(JUN, L.solo, NOW)).toEqual({ starsAwarded: 20, weekDone: true, lessonStars: 10, bonusStars: 0 }); // lesson + week bonus (single-lesson week)
    expect(await completeLesson(JUN, L.solo, NOW)).toEqual({ starsAwarded: 0, weekDone: false, lessonStars: 10, bonusStars: 0 });
    expect(await count('wp_lesson_completions', JUN)).toBe(1);
    expect(await stars(JUN)).toBe(20);
  });

  it('awards the week bonus once when the last lesson is completed twice', async () => {
    const { completeLesson } = await import('@/lib/db/kid');
    expect(await completeLesson(LEO, L.a, NOW)).toEqual({ starsAwarded: 10, weekDone: false, lessonStars: 10, bonusStars: 0 });
    expect(await completeLesson(LEO, L.b, NOW)).toEqual({ starsAwarded: 10, weekDone: false, lessonStars: 10, bonusStars: 0 });
    expect(await completeLesson(LEO, L.c, NOW)).toEqual({ starsAwarded: 20, weekDone: true, lessonStars: 10, bonusStars: 0 });
    expect(await completeLesson(LEO, L.c, NOW)).toEqual({ starsAwarded: 0, weekDone: false, lessonStars: 10, bonusStars: 0 });
    const bonus = await sql`select 1 from wp_star_events where student_id = ${LEO} and reason = 'week_bonus'`;
    expect(bonus).toHaveLength(1);
    expect(await stars(LEO)).toBe(40);
  });

  it('concurrent calls for one lesson award 10 in total', async () => {
    const { completeLesson } = await import('@/lib/db/kid');
    const rs = await Promise.all(Array.from({ length: 8 }, () => completeLesson(MINA, L.a, NOW)));
    expect(rs.reduce((n, r) => n + r.starsAwarded, 0)).toBe(10);
    expect(await count('wp_lesson_completions', MINA)).toBe(1);
    expect(await stars(MINA)).toBe(10);
  });

  it('concurrent completion of the last two lessons awards the bonus exactly once', async () => {
    const { completeLesson } = await import('@/lib/db/kid');
    // MINA already has L.a; finish b and c at the same time, several times over
    const rs = await Promise.all([L.b, L.c, L.b, L.c].map((l) => completeLesson(MINA, l, NOW)));
    expect(rs.reduce((n, r) => n + r.starsAwarded, 0)).toBe(10 + 10 + 10); // two lessons + one bonus
    expect(rs.filter((r) => r.weekDone)).toHaveLength(1);
    const bonus = await sql`select 1 from wp_star_events where student_id = ${MINA} and reason = 'week_bonus'`;
    expect(bonus).toHaveLength(1);
  });

  it('last two lessons finished in parallel (exactly [b, c]) never miss the bonus', async () => {
    const { completeLesson } = await import('@/lib/db/kid');
    const cls = id(8100);
    await sql`insert into wp_classes (id, grade, name, class_code) values (${cls}, 1, 'Race', 'RACE22')`;
    await sql`insert into wp_plan_assignments (plan_id, class_id) values (${P.plan}, ${cls})`;
    for (let i = 0; i < 20; i++) {
      const s = id(8200 + i);
      await sql`insert into wp_students (id, class_id, display_name, link_secret) values (${s}, ${cls}, ${'R' + i}, ${'race-' + i})`;
      await completeLesson(s, L.a, NOW);
      const rs = await Promise.all([completeLesson(s, L.b, NOW), completeLesson(s, L.c, NOW)]);
      expect(rs.reduce((n, r) => n + r.starsAwarded, 0), `student ${i}`).toBe(30);
      expect(rs.filter((r) => r.weekDone), `student ${i}`).toHaveLength(1);
      expect(await stars(s)).toBe(40);
    }
  });

  it('rejects unassigned, locked-week and unknown lessons without writing', async () => {
    const { completeLesson, NotFoundError } = await import('@/lib/db/kid');
    await expect(completeLesson(JUN, L.other, NOW)).rejects.toBeInstanceOf(NotFoundError);
    await expect(completeLesson(JUN, L.fut, NOW)).rejects.toBeInstanceOf(NotFoundError);
    await expect(completeLesson(JUN, id(9999), NOW)).rejects.toBeInstanceOf(NotFoundError);
    expect((await sql`select 1 from wp_lesson_completions where lesson_id in (${L.other}, ${L.fut})`)).toHaveLength(0);
  });

  it('works for a plan assigned directly to the student', async () => {
    const { completeLesson } = await import('@/lib/db/kid');
    await sql`insert into wp_plan_assignments (plan_id, student_id) values (${P.other}, ${JUN})`;
    expect((await completeLesson(JUN, L.other, NOW)).starsAwarded).toBe(20);
  });
});

describe('recordAttempt', () => {
  const A = id(500);
  it('stores one row and awards one star for a retried free-correct submit', async () => {
    const { recordAttempt } = await import('@/lib/db/kid');
    const body = { clientAttemptId: A, questionId: Q.a1, correct: true, context: 'free' as const };
    expect(await recordAttempt(JUN, body, NOW)).toEqual({ starsAwarded: 1 });
    expect(await recordAttempt(JUN, body, NOW)).toEqual({ starsAwarded: 1 }); // original, not 0
    expect(await sql`select 1 from wp_attempts where client_attempt_id = ${A}`).toHaveLength(1);
    const ev = await sql`select * from wp_star_events where student_id = ${JUN} and reason = 'free_correct'`;
    expect(ev).toHaveLength(1);
    expect(ev[0].plan_id).toBe(P.plan);
    expect(ev[0].amount).toBe(1);
  });

  it('concurrent double-tap awards once and every call reports the same award', async () => {
    const { recordAttempt } = await import('@/lib/db/kid');
    const body = { clientAttemptId: id(501), questionId: Q.a2, correct: true, context: 'free' as const };
    const rs = await Promise.all([recordAttempt(LEO, body, NOW), recordAttempt(LEO, body, NOW), recordAttempt(LEO, body, NOW)]);
    // Q.a2 is one of Leo's practice bonus questions on this Seoul day: 2 stars
    expect(rs).toEqual([{ starsAwarded: 2 }, { starsAwarded: 2 }, { starsAwarded: 2 }]);
    expect(await sql`select 1 from wp_star_events e join wp_attempts a on a.id = e.ref_id where a.client_attempt_id = ${id(501)}`).toHaveLength(1);
  });

  it('wrong and lesson-context answers award 0 (and a replayed wrong answer stays 0)', async () => {
    const { recordAttempt } = await import('@/lib/db/kid');
    const wrong = { clientAttemptId: id(502), questionId: Q.a1, correct: false, context: 'free' as const };
    expect(await recordAttempt(LEO, wrong, NOW)).toEqual({ starsAwarded: 0 });
    expect(await recordAttempt(LEO, wrong, NOW)).toEqual({ starsAwarded: 0 });
    const inLesson = { clientAttemptId: id(503), questionId: Q.a1, correct: true, context: 'lesson' as const };
    expect(await recordAttempt(LEO, inLesson, NOW)).toEqual({ starsAwarded: 0 });
    expect(await sql`select 1 from wp_attempts where client_attempt_id in (${id(502)}, ${id(503)})`).toHaveLength(2);
  });

  it('same clientAttemptId from a different student writes nothing and leaks nothing', async () => {
    const { recordAttempt } = await import('@/lib/db/kid');
    const r = await recordAttempt(MINA, { clientAttemptId: A, questionId: Q.a1, correct: true, context: 'free' }, NOW);
    expect(r).toEqual({ starsAwarded: 0 });
    expect(await count('wp_attempts', MINA)).toBe(0);
    expect(await sql`select 1 from wp_attempts where client_attempt_id = ${A}`).toHaveLength(1);
  });

  it('rejects unassigned and locked-week questions', async () => {
    const { recordAttempt, NotFoundError } = await import('@/lib/db/kid');
    for (const [n, q] of [[510, Q.other], [511, Q.fut], [512, id(9998)]] as const) {
      await expect(recordAttempt(MINA, { clientAttemptId: id(n), questionId: q, correct: true, context: 'free' }, NOW))
        .rejects.toBeInstanceOf(NotFoundError);
    }
    expect(await count('wp_attempts', MINA)).toBe(0);
  });

  it('still accepts attempts on a soft-deleted question', async () => {
    const { recordAttempt } = await import('@/lib/db/kid');
    await sql`update wp_questions set deleted_at = now() where id = ${Q.b1}`;
    expect(await recordAttempt(MINA, { clientAttemptId: id(513), questionId: Q.b1, correct: true, context: 'free' }, NOW))
      .toEqual({ starsAwarded: 2 }); // Q.b1 is one of Mina's practice bonus questions on this Seoul day
  });
});

describe('weeks with no opens_on', () => {
  it('stay locked (fail closed) for writes and in getHome', async () => {
    const { completeLesson, recordAttempt, getHome, NotFoundError } = await import('@/lib/db/kid');
    const p = id(600), w = id(601), l = id(602), q = id(603), s = id(604), c = id(605);
    await sql`insert into wp_classes (id, grade, name, class_code) values (${c}, 3, 'Null', 'NUL333')`;
    await sql`insert into wp_students (id, class_id, display_name, link_secret) values (${s}, ${c}, 'N', 'null-secret')`;
    await sql`insert into wp_plans (id, title, kind) values (${p}, 'NullPlan', 'winter')`;
    await sql`insert into wp_plan_assignments (plan_id, class_id) values (${p}, ${c})`;
    await sql`insert into wp_weeks (id, plan_id, position, skill, opens_on) values (${w}, ${p}, 1, 'x', null)`;
    await sql`insert into wp_lessons (id, week_id, position, title) values (${l}, ${w}, 1, 'N')`;
    await sql`insert into wp_questions (id, lesson_id, position, type, payload) values (${q}, ${l}, 1, 'pick', '{}')`;
    await expect(completeLesson(s, l, NOW)).rejects.toBeInstanceOf(NotFoundError);
    await expect(recordAttempt(s, { clientAttemptId: id(606), questionId: q, correct: true, context: 'free' }, NOW))
      .rejects.toBeInstanceOf(NotFoundError);
    const h = await getHome(s, NOW);
    expect(h.weeks[0]).toMatchObject({ opensOn: null, open: false });
    expect(h.currentWeekId).toBeNull();
  });
});

describe('getHome and setBlobColor', () => {
  it('returns the assigned plan, weeks, open/done flags and only assigned-plan stars', async () => {
    const { getHome } = await import('@/lib/db/kid');
    // MINA has the 99-star event on the unassigned plan; it must not count
    const home = await getHome(MINA, NOW);
    expect(home.student).toEqual({ id: MINA, displayName: 'Mina', blobColor: null });
    expect(home.plan).toEqual({ id: P.plan, title: 'Winter' });
    expect(home.totalStars).toBe(10 + 10 + 10 + 10 /* 3 lessons + bonus */ + 2 /* soft-deleted free, a bonus that day */);
    expect(home.weeks.map((w) => [w.skill, w.open, w.done])).toEqual([
      ['nouns', true, true],
      ['verbs', true, false],
      ['future', false, false],
      ['empty', true, false], // zero lessons is never done
    ]);
    expect(home.weeks[0].lessons.map((l) => [l.title, l.done])).toEqual([['A', true], ['B', true], ['C', true]]);
    expect(home.weeks[0]).toMatchObject({ id: W1, opensOn: '2026-01-01' });
    expect(home.currentWeekId).toBe(W2); // first open week not done
  });

  it('currentWeekId falls back to the last open week, or null', async () => {
    const { getHome } = await import('@/lib/db/kid');
    const before = new Date('2025-12-01T00:00:00Z');
    expect((await getHome(MINA, before)).currentWeekId).toBeNull();
    expect((await getHome(MINA, before)).weeks.every((w) => !w.open)).toBe(true);
  });

  it('currentWeekId is the last open week when everything open is done', async () => {
    const { getHome } = await import('@/lib/db/kid');
    const early = new Date('2026-01-01T03:00:00Z'); // only W1 is open, and MINA finished it
    expect((await getHome(MINA, early)).currentWeekId).toBe(W1);
  });

  it('a student with no plan gets plan null', async () => {
    const { getHome } = await import('@/lib/db/kid');
    const other = id(7);
    const cls = id(8);
    await sql`insert into wp_classes (id, grade, name, class_code) values (${cls}, 2, 'G2', 'QQQ222')`;
    await sql`insert into wp_students (id, class_id, display_name, link_secret) values (${other}, ${cls}, 'Zed', 'zz')`;
    const h = await getHome(other, NOW);
    expect(h.plan).toBeNull();
    expect(h.weeks).toEqual([]);
    expect(h.totalStars).toBe(0);
    expect(h.currentWeekId).toBeNull();
  });

  it('setBlobColor stores the key', async () => {
    const { setBlobColor, studentById } = await import('@/lib/db/kid');
    await setBlobColor(JUN, 'grape');
    expect((await studentById(JUN))?.blob_color).toBe('grape');
  });
});
