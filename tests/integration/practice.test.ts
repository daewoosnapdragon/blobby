import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resetTestDb, TEST_DATABASE_URL } from './helpers/db';
import { seed, CLASS, STUDENTS } from '../e2e/fixtures/seed';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.SESSION_SECRET = 'int-secret';

let sql: Awaited<ReturnType<typeof resetTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = new Date('2026-01-10T03:00:00Z'); // Seoul 2026-01-10 12:00
const [MINA, LEO, JUN] = [STUDENTS.mina.id, STUDENTS.leo.id, STUDENTS.jun.id];

const P = { mine: id(100), other: id(101), direct: id(102) };
const W = { open: id(200), open2: id(201), future: id(202), noDate: id(203), other: id(204), direct: id(205) };
const L = { open: id(300), open2: id(301), future: id(302), noDate: id(303), other: id(304), direct: id(305) };
const Q = {
  a: id(400), b: id(401), c: id(402), deleted: id(403), watch: id(404), future: id(405), noDate: id(406),
  other: id(407), open2: id(408), direct: id(409),
};
const pick = (prompt: string) => ({ prompt, choices: ['x', 'y'], answer: 0 });

beforeAll(async () => {
  sql = await resetTestDb();
  await seed(sql);
  await sql`insert into wp_plans (id, title, kind, created_at) values
    (${P.mine}, 'Winter', 'winter', '2026-01-01'), (${P.other}, 'Elsewhere', 'test', '2026-01-02'), (${P.direct}, 'Just Jun', 'test', '2026-01-03')`;
  await sql`insert into wp_plan_assignments (plan_id, class_id) values (${P.mine}, ${CLASS.id})`;
  await sql`insert into wp_plan_assignments (plan_id, student_id) values (${P.direct}, ${JUN})`;
  await sql`insert into wp_weeks (id, plan_id, position, skill, opens_on) values
    (${W.open}, ${P.mine}, 1, 'nouns', '2026-01-01'),
    (${W.open2}, ${P.mine}, 2, 'verbs', '2026-01-10'),
    (${W.future}, ${P.mine}, 3, 'future', '2026-01-11'),
    (${W.noDate}, ${P.mine}, 4, 'undated', null),
    (${W.other}, ${P.other}, 1, 'other', '2026-01-01'),
    (${W.direct}, ${P.direct}, 1, 'direct', '2026-01-01')`;
  await sql`insert into wp_lessons (id, week_id, position, title) values
    (${L.open}, ${W.open}, 1, 'A'), (${L.open2}, ${W.open2}, 1, 'B'), (${L.future}, ${W.future}, 1, 'F'),
    (${L.noDate}, ${W.noDate}, 1, 'N'), (${L.other}, ${W.other}, 1, 'O'), (${L.direct}, ${W.direct}, 1, 'D')`;
  const rows: [string, string, number, string, unknown][] = [
    [Q.a, L.open, 1, 'pick_one', pick('a')], [Q.b, L.open, 2, 'pick_one', pick('b')], [Q.c, L.open, 3, 'pick_one', pick('c')],
    [Q.deleted, L.open, 4, 'pick_one', pick('deleted')],
    [Q.watch, L.open, 5, 'watch_answer', { youtubeId: 'dQw4w9WgXcQ', questions: [{ type: 'pick_one', ...pick('w') }] }],
    [Q.open2, L.open2, 1, 'pick_one', pick('open2')],
    [Q.future, L.future, 1, 'pick_one', pick('future')], [Q.noDate, L.noDate, 1, 'pick_one', pick('undated')],
    [Q.other, L.other, 1, 'pick_one', pick('other')], [Q.direct, L.direct, 1, 'pick_one', pick('direct')],
  ];
  for (const [qid, lesson, position, type, payload] of rows) {
    await sql`insert into wp_questions (id, lesson_id, position, type, payload, audio)
      values (${qid}, ${lesson}, ${position}, ${type}, ${sql.json(payload as never)}, ${sql.json({ [`${position}`]: 'https://x/a.mp3', bad: 5 } as never)})`;
  }
  await sql`update wp_questions set deleted_at = now() where id = ${Q.deleted}`;
});
afterAll(async () => {
  await sql.end();
});

const attempt = (student: string, question: string, correct: boolean, context: 'lesson' | 'free', at: string) =>
  sql`insert into wp_attempts (student_id, question_id, client_attempt_id, correct, context, created_at)
      values (${student}, ${question}, gen_random_uuid(), ${correct}, ${context}, ${at})`;

describe('getMissedIds', () => {
  it('a wrong latest attempt is missed; a later correct one (lesson or free) clears it', async () => {
    const { getMissedIds } = await import('@/lib/db/kid');
    await attempt(MINA, Q.a, false, 'lesson', '2026-01-09T01:00:00Z');
    await attempt(MINA, Q.b, false, 'lesson', '2026-01-09T01:01:00Z');
    await attempt(MINA, Q.c, false, 'free', '2026-01-09T01:02:00Z');
    expect([...(await getMissedIds(MINA))].sort()).toEqual([Q.a, Q.b, Q.c].sort());

    await attempt(MINA, Q.a, true, 'free', '2026-01-09T02:00:00Z'); // fixed in free practice
    await attempt(MINA, Q.b, true, 'lesson', '2026-01-09T02:01:00Z'); // fixed in a lesson
    expect([...(await getMissedIds(MINA))]).toEqual([Q.c]);

    await attempt(MINA, Q.a, false, 'free', '2026-01-09T03:00:00Z'); // missed again
    expect([...(await getMissedIds(MINA))].sort()).toEqual([Q.a, Q.c].sort());
  });

  it('is per kid and leaves out soft-deleted questions', async () => {
    const { getMissedIds } = await import('@/lib/db/kid');
    await attempt(LEO, Q.deleted, false, 'lesson', '2026-01-09T01:00:00Z');
    expect((await getMissedIds(LEO)).size).toBe(0);
    expect((await getMissedIds(MINA)).has(Q.deleted)).toBe(false);
  });
});

describe('getPracticeSet', () => {
  it('holds only open-week, non-deleted, non-watch questions of assigned plans', async () => {
    const { getPracticeSet } = await import('@/lib/db/kid');
    const set = await getPracticeSet(MINA, NOW);
    const ids = set.map((q) => q.id).sort();
    expect(ids).toEqual([Q.a, Q.b, Q.c, Q.open2].sort());
    expect(set.every((q) => q.question.type === 'pick_one')).toBe(true);
    // audio: only string URLs are kept
    const first = set.find((q) => q.id === Q.a)!;
    expect(first.audio).toEqual({ '1': 'https://x/a.mp3' });
  });

  it('caps at 8 and returns unique questions', async () => {
    const { getPracticeSet } = await import('@/lib/db/kid');
    const extra = Array.from({ length: 12 }, (_, i) => id(900 + i));
    for (const [i, qid] of extra.entries()) {
      await sql`insert into wp_questions (id, lesson_id, position, type, payload)
        values (${qid}, ${L.open2}, ${10 + i}, 'pick_one', ${sql.json(pick(`e${i}`) as never)})`;
    }
    const set = await getPracticeSet(MINA, NOW);
    expect(set).toHaveLength(8);
    expect(new Set(set.map((q) => q.id)).size).toBe(8);
    await sql`delete from wp_questions where id = any(${extra}::uuid[])`;
  });

  it('serves a directly assigned plan, and only that kid', async () => {
    const { getPracticeSet } = await import('@/lib/db/kid');
    const jun = (await getPracticeSet(JUN, NOW)).map((q) => q.id);
    expect(jun).toContain(Q.direct);
    expect(jun).toContain(Q.a); // class plan too
    expect((await getPracticeSet(MINA, NOW)).map((q) => q.id)).not.toContain(Q.direct);
    expect(jun).not.toContain(Q.other);
  });

  it('is empty before any week opens', async () => {
    const { getPracticeSet, practiceAvailable } = await import('@/lib/db/kid');
    const early = new Date('2025-12-01T03:00:00Z');
    expect(await getPracticeSet(MINA, early)).toEqual([]);
    expect(await practiceAvailable(MINA, early)).toBe(false);
    expect(await practiceAvailable(MINA, NOW)).toBe(true);
  });

  it('a soft-deleted question never shows, even when missed', async () => {
    const { getPracticeSet } = await import('@/lib/db/kid');
    await attempt(MINA, Q.deleted, false, 'lesson', '2026-01-09T05:00:00Z');
    for (let i = 0; i < 20; i++) expect((await getPracticeSet(MINA, NOW)).map((q) => q.id)).not.toContain(Q.deleted);
  });
});

describe('free practice stars', () => {
  it('a first correct free answer earns exactly 1 star, once, however often it is sent', async () => {
    const { recordAttempt } = await import('@/lib/db/kid');
    const body = { clientAttemptId: id(7001), questionId: Q.open2, correct: true, context: 'free' as const };
    expect(await recordAttempt(LEO, body, NOW)).toEqual({ starsAwarded: 1 });
    expect(await recordAttempt(LEO, body, NOW)).toEqual({ starsAwarded: 1 }); // retry reports the original award
    const [{ n }] = await sql`select coalesce(sum(amount),0)::int as n from wp_star_events where student_id = ${LEO}`;
    expect(n).toBe(1);
    // wrong answers never earn or subtract
    expect(await recordAttempt(LEO, { clientAttemptId: id(7002), questionId: Q.b, correct: false, context: 'free' }, NOW)).toEqual({ starsAwarded: 0 });
    const [{ m }] = await sql`select coalesce(sum(amount),0)::int as m from wp_star_events where student_id = ${LEO}`;
    expect(m).toBe(1);
  });
});
