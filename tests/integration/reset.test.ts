import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { resetTestDb, TEST_DATABASE_URL } from './helpers/db';
import { seed, CLASS, STUDENTS } from '../e2e/fixtures/seed';
import { resetTestStars } from '../../src/lib/resetTestStars';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.SESSION_SECRET = 'int-secret';

let sql: Awaited<ReturnType<typeof resetTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [MINA, LEO] = [STUDENTS.mina.id, STUDENTS.leo.id];
const P = { test: id(100), winter: id(101), test2: id(102) };
const NOW = new Date('2026-01-10T03:00:00Z');

const SQL_FILE = fs.readFileSync(path.resolve(__dirname, '../../supabase/reset-test-stars.sql'), 'utf8');
const MARKER = '-- >>> PART 2 STARTS HERE <<<';

async function build() {
  await sql.unsafe(`truncate wp_star_events, wp_plan_assignments, wp_practice_days, wp_lesson_completions, wp_attempts, wp_questions, wp_lessons, wp_weeks, wp_plans cascade`);
  await sql`update wp_students set blob_color = 'mint' where id = ${LEO}`;
  await sql`insert into wp_plans (id, title, kind) values (${P.test}, 'Test weeks', 'test'), (${P.winter}, 'Winter', 'winter'), (${P.test2}, 'Second test', 'test')`;
  await sql`insert into wp_plan_assignments (plan_id, class_id) values (${P.test}, ${CLASS.id}), (${P.winter}, ${CLASS.id})`;
  await sql`insert into wp_plan_assignments (plan_id, student_id) values (${P.test2}, ${MINA})`;
  await sql`insert into wp_weeks (id, plan_id, position, skill, opens_on) values (${id(200)}, ${P.test}, 1, 'a', '2026-01-01'), (${id(201)}, ${P.winter}, 1, 'b', '2026-01-01')`;
  await sql`insert into wp_lessons (id, week_id, position, title) values (${id(300)}, ${id(200)}, 1, 'T'), (${id(301)}, ${id(201)}, 1, 'W')`;
  await sql`insert into wp_questions (id, lesson_id, position, type, payload) values (${id(400)}, ${id(300)}, 1, 'pick', '{}')`;
  await sql`insert into wp_star_events (student_id, plan_id, amount, reason, ref_id) values
    (${MINA}, ${P.test}, 10, 'lesson', ${id(300)}),
    (${LEO}, ${P.test}, 10, 'lesson', ${id(300)}),
    (${LEO}, ${P.test2}, 1, 'free_correct', ${id(900)}),
    (${MINA}, ${P.winter}, 10, 'lesson', ${id(301)}),
    (${MINA}, null, 1, 'free_correct', ${id(901)})`;
  await sql`insert into wp_practice_days (student_id, day, seconds) values (${MINA}, '2026-01-09', 120), (${LEO}, '2026-01-09', 60)`;
  await sql`insert into wp_lesson_completions (student_id, lesson_id) values (${MINA}, ${id(300)})`;
  await sql`insert into wp_attempts (student_id, question_id, client_attempt_id, correct, context) values (${MINA}, ${id(400)}, ${id(950)}, true, 'lesson')`;
}

const n = async (t: string) => Number((await sql.unsafe(`select count(*)::int as n from ${t}`))[0].n);

beforeAll(async () => {
  sql = await resetTestDb();
  await seed(sql);
});
beforeEach(build);
afterAll(async () => { await sql.end(); });

async function expectKept() {
  expect(await n('wp_practice_days')).toBe(2);
  expect(await n('wp_lesson_completions')).toBe(1);
  expect(await n('wp_attempts')).toBe(1);
  expect((await sql`select blob_color from wp_students where id = ${LEO}`)[0].blob_color).toBe('mint');
  const left = await sql`select plan_id, amount from wp_star_events order by amount, plan_id`;
  expect(left.map((r) => r.plan_id).sort()).toEqual([null, P.winter].sort());
  expect(await sql`select 1 from wp_plans where kind = 'test'`).toHaveLength(2);
}

describe('resetTestStars', () => {
  it('dry run reports counts and changes nothing', async () => {
    const r = await resetTestStars(sql, { dryRun: true });
    expect(r.dryRun).toBe(true);
    expect(r.starEvents).toBe(3);
    expect(r.assignments).toBe(2);
    expect(r.byPlan).toEqual([
      { title: 'Second test', events: 1 },
      { title: 'Test weeks', events: 2 },
    ]);
    expect(await n('wp_star_events')).toBe(5);
    expect(await n('wp_plan_assignments')).toBe(3);
  });

  it('deletes test-plan stars and assignments, keeps everything else', async () => {
    const r = await resetTestStars(sql, { dryRun: false });
    expect(r).toMatchObject({ dryRun: false, starEvents: 3, assignments: 2 });
    await expectKept();
    expect(await sql`select 1 from wp_plan_assignments where plan_id in (${P.test}, ${P.test2})`).toHaveLength(0);
    expect(await n('wp_plan_assignments')).toBe(1);
  });

  it('test plan no longer shows on home and stars exclude it', async () => {
    const { getHome } = await import('@/lib/db/kid');
    const { totalStarsFor } = await import('@/lib/db/kid');
    expect((await getHome(MINA, NOW)).totalStars).toBe(10 + 10);
    await resetTestStars(sql, { dryRun: false });
    const h = await getHome(MINA, NOW);
    expect(h.plan?.title).toBe('Winter');
    expect(h.totalStars).toBe(10);
    expect(await totalStarsFor(LEO)).toBe(0);
  });

  it('is idempotent', async () => {
    await resetTestStars(sql, { dryRun: false });
    const r = await resetTestStars(sql, { dryRun: false });
    expect(r).toMatchObject({ starEvents: 0, assignments: 0, byPlan: [] });
    await expectKept();
  });
});

describe('supabase/reset-test-stars.sql', () => {
  const [part1, part2] = SQL_FILE.split(MARKER);

  it('has a plain STOP banner right at the PART 2 marker, and no "stars records" typo', () => {
    const stop = 'STOP. Run PART 1 alone first and check the numbers. Only then select and run PART 2.';
    const markerLine = SQL_FILE.split('\n').findIndex((l) => l === MARKER);
    const near = SQL_FILE.split('\n').slice(Math.max(0, markerLine - 6), markerLine + 1).join('\n');
    expect(near).toContain(stop);
    expect(SQL_FILE).not.toMatch(/stars records/);
  });

  it('has both parts and only wp_ tables', () => {
    expect(part2).toBeTruthy();
    expect(part2).toMatch(/begin;/i);
    expect(part2).toMatch(/commit;/i);
    const code = SQL_FILE.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    const tables = [...code.matchAll(/\b(?:from|join|into|update|table)\s+([a-z_]+)/gi)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThan(0);
    for (const t of tables) expect(t).toMatch(/^wp_/);
  });

  it('PART 1 shows the same counts and changes nothing', async () => {
    const rows = await sql.unsafe(part1);
    const byPlan = Object.fromEntries(rows.map((r: any) => [r.plan, r]));
    expect(Number(byPlan['Test weeks'].star_events_to_delete)).toBe(2);
    expect(Number(byPlan['Second test'].star_events_to_delete)).toBe(1);
    expect(Number(byPlan['Test weeks'].assignments_to_remove)).toBe(1);
    expect(Number(byPlan['TOTAL'].star_events_to_delete)).toBe(3);
    expect(Number(byPlan['TOTAL'].assignments_to_remove)).toBe(2);
    expect(await n('wp_star_events')).toBe(5);
    expect(await n('wp_plan_assignments')).toBe(3);
  });

  it('PART 2 resets, keeps the rest, and is idempotent', async () => {
    await sql.unsafe(part2);
    await expectKept();
    expect(await n('wp_plan_assignments')).toBe(1);
    await sql.unsafe(part2);
    await expectKept();
    expect(await n('wp_plan_assignments')).toBe(1);
  });
});
