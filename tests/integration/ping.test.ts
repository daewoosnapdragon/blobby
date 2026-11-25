import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resetTestDb, TEST_DATABASE_URL } from './helpers/db';
import { seed, CLASS, STUDENTS } from '../e2e/fixtures/seed';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.SESSION_SECRET = 'int-secret';

let sql: Awaited<ReturnType<typeof resetTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = new Date('2026-01-10T03:00:00Z'); // Seoul 2026-01-10 12:00
const [MINA, LEO, JUN] = [STUDENTS.mina.id, STUDENTS.leo.id, STUDENTS.jun.id];
const P = id(100), W = id(200), L = id(300), Q = { live: id(400), deleted: id(401) };

beforeAll(async () => {
  sql = await resetTestDb();
  await seed(sql);
  await sql`insert into wp_plans (id, title, kind) values (${P}, 'Winter', 'winter')`;
  await sql`insert into wp_plan_assignments (plan_id, class_id) values (${P}, ${CLASS.id})`;
  await sql`insert into wp_weeks (id, plan_id, position, skill, opens_on) values (${W}, ${P}, 1, 'nouns', '2026-01-01')`;
  await sql`insert into wp_lessons (id, week_id, position, title) values (${L}, ${W}, 1, 'A')`;
  for (const [qid, pos] of [[Q.live, 1], [Q.deleted, 2]] as const) {
    await sql`insert into wp_questions (id, lesson_id, position, type, payload)
      values (${qid}, ${L}, ${pos}, 'pick_one', ${sql.json({ prompt: 'p', choices: ['x', 'y'], answer: 0 })})`;
  }
  await sql`update wp_questions set deleted_at = now() where id = ${Q.deleted}`;
});
afterAll(async () => {
  await sql.end();
});

const days = (s: string) => sql<{ day: string; seconds: number }[]>`
  select day, seconds from wp_practice_days where student_id = ${s} order by day`;
const attempt = (s: string, q: string) => ({ clientAttemptId: crypto.randomUUID(), questionId: q, correct: true, context: 'lesson' as const });

describe('ping', () => {
  it('upserts the Seoul-date row and adds 30 seconds each time', async () => {
    const { ping } = await import('@/lib/db/kid');
    await ping(MINA, NOW);
    expect(await days(MINA)).toEqual([{ day: '2026-01-10', seconds: 30 }]);
    await ping(MINA, NOW);
    expect(await days(MINA)).toEqual([{ day: '2026-01-10', seconds: 60 }]);
  });

  it('caps a day at 10,800 seconds', async () => {
    const { ping } = await import('@/lib/db/kid');
    await sql`insert into wp_practice_days (student_id, day, seconds) values (${LEO}, '2026-01-10', 10790)`;
    await ping(LEO, NOW);
    await ping(LEO, NOW);
    expect(await days(LEO)).toEqual([{ day: '2026-01-10', seconds: 10800 }]);
  });

  it('uses the Seoul date at the 15:00Z boundary', async () => {
    const { ping } = await import('@/lib/db/kid');
    await ping(JUN, new Date('2026-01-10T14:59:59Z'));
    await ping(JUN, new Date('2026-01-10T15:00:00Z'));
    expect(await days(JUN)).toEqual([
      { day: '2026-01-10', seconds: 30 },
      { day: '2026-01-11', seconds: 30 },
    ]);
  });
});

describe('attempts mark the day', () => {
  it('records a 0-second row, and never resets seconds already counted', async () => {
    const { recordAttempt, ping } = await import('@/lib/db/kid');
    await sql`delete from wp_practice_days where student_id = ${MINA}`;
    await recordAttempt(MINA, attempt(MINA, Q.live), NOW);
    expect(await days(MINA)).toEqual([{ day: '2026-01-10', seconds: 0 }]);
    await ping(MINA, NOW);
    await recordAttempt(MINA, attempt(MINA, Q.live), NOW);
    expect(await days(MINA)).toEqual([{ day: '2026-01-10', seconds: 30 }]);
  });

  it('also marks the day for a soft-deleted question', async () => {
    const { recordAttempt } = await import('@/lib/db/kid');
    await sql`delete from wp_practice_days where student_id = ${MINA}`;
    await recordAttempt(MINA, attempt(MINA, Q.deleted), NOW);
    expect(await days(MINA)).toEqual([{ day: '2026-01-10', seconds: 0 }]);
  });

  it('uses the Seoul date at the 15:00Z boundary', async () => {
    const { recordAttempt } = await import('@/lib/db/kid');
    await sql`delete from wp_practice_days where student_id = ${MINA}`;
    await recordAttempt(MINA, attempt(MINA, Q.live), new Date('2026-01-10T15:00:00Z'));
    expect((await days(MINA)).map((d) => d.day)).toEqual(['2026-01-11']);
  });
});

describe('practicedDays', () => {
  it('lists the kid’s days in a month, only theirs', async () => {
    const { practicedDays } = await import('@/lib/db/kid');
    await sql`delete from wp_practice_days`;
    await sql`insert into wp_practice_days (student_id, day, seconds) values
      (${MINA}, '2025-12-31', 5), (${MINA}, '2026-01-03', 0), (${MINA}, '2026-01-10', 60), (${MINA}, '2026-02-01', 9), (${LEO}, '2026-01-04', 9)`;
    expect(await practicedDays(MINA, '2026-01')).toEqual(['2026-01-03', '2026-01-10']);
  });
});
